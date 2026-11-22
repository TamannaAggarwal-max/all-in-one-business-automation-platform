import { and, asc, eq, lt } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import { activities, customers, followUps, leads, users } from '../../db/schema.ts';
import { type AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';

const router = Router();
router.use(requireAuth);

const createFollowUpSchema = z.object({
  leadId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD date format'),
  dueTime: z.string().trim().min(3).default('11:00'),
  type: z.enum(['Call', 'WhatsApp', 'Email', 'Meeting']).default('WhatsApp'),
  notes: z.string().trim().optional().default(''),
});

router.get('/', requireRole('ADMIN', 'MANAGER', 'SALES_EMPLOYEE'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const today = new Date().toISOString().slice(0, 10);

    // Mark past-due Pending follow-ups as Overdue
    await db
      .update(followUps)
      .set({ status: 'Overdue', updatedAt: new Date() })
      .where(
        and(
          eq(followUps.businessId, businessId),
          eq(followUps.status, 'Pending'),
          lt(followUps.dueDate, today)
        )
      );

    const rows = await db
      .select({
        id: followUps.id,
        businessId: followUps.businessId,
        leadId: followUps.leadId,
        leadName: leads.name,
        leadCompany: leads.company,
        customerId: followUps.customerId,
        customerName: customers.name,
        assignedUserId: followUps.assignedUserId,
        assignedUserName: users.fullName,
        dueDate: followUps.dueDate,
        dueTime: followUps.dueTime,
        type: followUps.type,
        notes: followUps.notes,
        status: followUps.status,
        createdAt: followUps.createdAt,
        updatedAt: followUps.updatedAt,
      })
      .from(followUps)
      .leftJoin(leads, eq(followUps.leadId, leads.id))
      .leftJoin(customers, eq(followUps.customerId, customers.id))
      .leftJoin(users, eq(followUps.assignedUserId, users.id))
      .where(eq(followUps.businessId, businessId))
      .orderBy(asc(followUps.dueDate), asc(followUps.dueTime));

    res.json({ followUps: rows, today });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('ADMIN', 'MANAGER', 'SALES_EMPLOYEE'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const parsed = createFollowUpSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid follow-up details' });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const status = parsed.data.dueDate < today ? 'Overdue' : 'Pending';

    const [created] = await db
      .insert(followUps)
      .values({
        businessId,
        leadId: parsed.data.leadId || null,
        customerId: parsed.data.customerId || null,
        assignedUserId: parsed.data.assignedUserId || req.authUser!.id,
        dueDate: parsed.data.dueDate,
        dueTime: parsed.data.dueTime,
        type: parsed.data.type,
        notes: parsed.data.notes,
        status,
      })
      .returning();

    if (created.leadId) {
      await db.insert(activities).values({
        businessId,
        leadId: created.leadId,
        userId: req.authUser!.id,
        type: 'FOLLOWUP_SCHEDULED',
        title: 'Follow-up Scheduled',
        description: `${created.type} follow-up set for ${created.dueDate} at ${created.dueTime}.`,
      });
    }

    res.status(201).json({ followUp: created });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireRole('ADMIN', 'MANAGER', 'SALES_EMPLOYEE'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const id = String(req.params.id);
    const schema = z.object({
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dueTime: z.string().optional(),
      type: z.enum(['Call', 'WhatsApp', 'Email', 'Meeting']).optional(),
      notes: z.string().optional(),
      status: z.enum(['Pending', 'Completed', 'Overdue']).optional(),
      assignedUserId: z.string().uuid().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid follow-up update' });
      return;
    }

    const [existing] = await db
      .select()
      .from(followUps)
      .where(and(eq(followUps.id, id), eq(followUps.businessId, businessId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'Follow-up not found' });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    let nextStatus = parsed.data.status ?? existing.status;
    if (parsed.data.dueDate && !parsed.data.status) {
      nextStatus = parsed.data.dueDate < today ? 'Overdue' : 'Pending';
    }

    const [updated] = await db
      .update(followUps)
      .set({
        ...parsed.data,
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(and(eq(followUps.id, id), eq(followUps.businessId, businessId)))
      .returning();

    if (updated.leadId && parsed.data.status === 'Completed' && existing.status !== 'Completed') {
      await db.insert(activities).values({
        businessId,
        leadId: updated.leadId,
        userId: req.authUser!.id,
        type: 'CUSTOMER_CONTACTED',
        title: 'Follow-up Completed',
        description: `Completed ${updated.type} follow-up (${updated.notes || 'No notes'}).`,
      });
    }

    res.json({ followUp: updated });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireRole('ADMIN', 'MANAGER', 'SALES_EMPLOYEE'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const id = String(req.params.id);
    const deleted = await db
      .delete(followUps)
      .where(and(eq(followUps.id, id), eq(followUps.businessId, businessId)))
      .returning({ id: followUps.id });

    if (deleted.length === 0) {
      res.status(404).json({ error: 'Follow-up not found' });
      return;
    }
    res.json({ deletedId: id });
  } catch (error) {
    next(error);
  }
});

export default router;
