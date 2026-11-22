import { and, asc, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import { automationActions, automations } from '../../db/schema.ts';
import { type AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';

const router = Router();
router.use(requireAuth);

const triggerEnum = z.enum([
  'NEW_LEAD',
  'WHATSAPP_LEAD',
  'WEBSITE_LEAD',
  'CALL_LEAD',
  'STATUS_CHANGED',
  'FOLLOWUP_DUE',
  'INACTIVE_LEAD',
]);

const actionEnum = z.enum([
  'CREATE_FOLLOWUP',
  'SEND_AUTOREPLY',
  'ASSIGN_EMPLOYEE',
  'CHANGE_STATUS',
  'CREATE_NOTIFICATION',
]);

const automationSchema = z.object({
  name: z.string().trim().min(2, 'Automation name is required'),
  description: z.string().trim().optional().default(''),
  triggerType: triggerEnum,
  status: z.enum(['ACTIVE', 'PAUSED']).default('ACTIVE'),
  actions: z
    .array(
      z.object({
        actionType: actionEnum,
        config: z.record(z.string(), z.unknown()).optional().default({}),
      })
    )
    .min(1, 'At least one automation action is required'),
});

router.get('/', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const rows = await db
      .select()
      .from(automations)
      .where(eq(automations.businessId, businessId))
      .orderBy(desc(automations.createdAt));

    const result = await Promise.all(
      rows.map(async (auto) => {
        const actions = await db
          .select()
          .from(automationActions)
          .where(eq(automationActions.automationId, auto.id))
          .orderBy(asc(automationActions.orderIndex));
        return { ...auto, actions };
      })
    );

    res.json({ automations: result });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const parsed = automationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid automation payload' });
      return;
    }

    const [created] = await db
      .insert(automations)
      .values({
        businessId,
        name: parsed.data.name,
        description: parsed.data.description,
        triggerType: parsed.data.triggerType,
        status: parsed.data.status,
      })
      .returning();

    const insertedActions = await db
      .insert(automationActions)
      .values(
        parsed.data.actions.map((a, idx) => ({
          automationId: created.id,
          actionType: a.actionType,
          config: a.config ?? {},
          orderIndex: idx,
        }))
      )
      .returning();

    res.status(201).json({ automation: { ...created, actions: insertedActions } });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const id = String(req.params.id);
    const parsed = automationSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid automation update' });
      return;
    }

    const [existing] = await db
      .select()
      .from(automations)
      .where(and(eq(automations.id, id), eq(automations.businessId, businessId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'Automation not found' });
      return;
    }

    const [updated] = await db
      .update(automations)
      .set({
        name: parsed.data.name ?? existing.name,
        description: parsed.data.description ?? existing.description,
        triggerType: parsed.data.triggerType ?? existing.triggerType,
        status: parsed.data.status ?? existing.status,
        updatedAt: new Date(),
      })
      .where(and(eq(automations.id, id), eq(automations.businessId, businessId)))
      .returning();

    if (parsed.data.actions) {
      await db.delete(automationActions).where(eq(automationActions.automationId, id));
      await db.insert(automationActions).values(
        parsed.data.actions.map((a, idx) => ({
          automationId: id,
          actionType: a.actionType,
          config: a.config ?? {},
          orderIndex: idx,
        }))
      );
    }

    const actions = await db
      .select()
      .from(automationActions)
      .where(eq(automationActions.automationId, id))
      .orderBy(asc(automationActions.orderIndex));

    res.json({ automation: { ...updated, actions } });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const id = String(req.params.id);

    const deleted = await db
      .delete(automations)
      .where(and(eq(automations.id, id), eq(automations.businessId, businessId)))
      .returning({ id: automations.id });

    if (deleted.length === 0) {
      res.status(404).json({ error: 'Automation not found' });
      return;
    }
    res.json({ deletedId: id });
  } catch (error) {
    next(error);
  }
});

export default router;
