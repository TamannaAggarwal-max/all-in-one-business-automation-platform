import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import { customers } from '../../db/schema.ts';
import { type AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';

const router = Router();
router.use(requireAuth);

router.get('/', requireRole('ADMIN', 'MANAGER', 'SALES_EMPLOYEE'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';

    const conditions = [eq(customers.businessId, businessId)];
    if (status && status !== 'All') conditions.push(eq(customers.status, status));
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(customers.name, pattern),
          ilike(customers.company, pattern),
          ilike(customers.email, pattern),
          ilike(customers.phone, pattern)
        )!
      );
    }

    const rows = await db
      .select()
      .from(customers)
      .where(and(...conditions))
      .orderBy(desc(customers.lastInteractionAt));

    res.json({ customers: rows });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireRole('ADMIN', 'MANAGER', 'SALES_EMPLOYEE'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const id = String(req.params.id);
    const schema = z.object({
      status: z.enum(['Active', 'Inactive']).optional(),
      logInteraction: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid customer update' });
      return;
    }

    const [existing] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, id), eq(customers.businessId, businessId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const [updated] = await db
      .update(customers)
      .set({
        status: parsed.data.status ?? existing.status,
        totalInteractions: parsed.data.logInteraction
          ? existing.totalInteractions + 1
          : existing.totalInteractions,
        lastInteractionAt: parsed.data.logInteraction ? new Date() : existing.lastInteractionAt,
        updatedAt: new Date(),
      })
      .where(and(eq(customers.id, id), eq(customers.businessId, businessId)))
      .returning();

    res.json({ customer: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
