import bcrypt from 'bcryptjs';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  customers,
  followUps,
  leads,
  notifications,
  products,
  users,
} from '../../db/schema.ts';
import { type AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';

export const teamRouter = Router();
teamRouter.use(requireAuth);

teamRouter.get('/', requireRole('ADMIN', 'MANAGER', 'SALES_EMPLOYEE'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const [members, allLeads, allFollowUps] = await Promise.all([
      db
        .select({
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          role: users.role,
          isActive: users.isActive,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.businessId, businessId)),
      db.select().from(leads).where(eq(leads.businessId, businessId)),
      db.select().from(followUps).where(eq(followUps.businessId, businessId)),
    ]);

    const enriched = members.map((m) => {
      const assigned = allLeads.filter((l) => l.assignedUserId === m.id);
      return {
        ...m,
        stats: {
          leadsAssigned: assigned.length,
          leadsContacted: assigned.filter((l) => l.status !== 'New').length,
          conversions: assigned.filter((l) => l.status === 'Converted').length,
          pendingFollowUps: allFollowUps.filter(
            (f) => f.assignedUserId === m.id && f.status !== 'Completed'
          ).length,
        },
      };
    });

    res.json({ members: enriched });
  } catch (error) {
    next(error);
  }
});

teamRouter.post('/', requireRole('ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const schema = z.object({
      fullName: z.string().trim().min(2, 'Full name is required'),
      email: z.string().trim().email('Valid email is required'),
      password: z.string().min(8, 'Temporary password must be at least 8 characters'),
      role: z.enum(['ADMIN', 'MANAGER', 'SALES_EMPLOYEE']).default('SALES_EMPLOYEE'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid employee details' });
      return;
    }

    const email = parsed.data.email.toLowerCase();
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const [created] = await db
      .insert(users)
      .values({
        businessId,
        fullName: parsed.data.fullName,
        email,
        passwordHash,
        role: parsed.data.role,
        isActive: true,
      })
      .returning({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    res.status(201).json({ member: created });
  } catch (error) {
    next(error);
  }
});

teamRouter.patch('/:id', requireRole('ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const id = String(req.params.id);
    const schema = z.object({
      role: z.enum(['ADMIN', 'MANAGER', 'SALES_EMPLOYEE']).optional(),
      isActive: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid team update' });
      return;
    }

    if (id === req.authUser!.id && parsed.data.isActive === false) {
      res.status(400).json({ error: 'You cannot deactivate your own admin account' });
      return;
    }

    const [updated] = await db
      .update(users)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.businessId, businessId)))
      .returning({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    if (!updated) {
      res.status(404).json({ error: 'Team member not found' });
      return;
    }
    res.json({ member: updated });
  } catch (error) {
    next(error);
  }
});

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.businessId, businessId))
      .orderBy(desc(notifications.createdAt))
      .limit(30);

    const unreadCount = rows.filter((n) => !n.isRead).length;
    res.json({ notifications: rows, unreadCount });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.patch('/:id/read', async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const id = String(req.params.id);
    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.businessId, businessId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    res.json({ notification: updated });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.post('/read-all', async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.businessId, businessId));
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export const searchRouter = Router();
searchRouter.use(requireAuth);

searchRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) {
      res.json({ leads: [], customers: [], products: [], employees: [] });
      return;
    }

    const pattern = `%${q}%`;
    const [matchedLeads, matchedCustomers, matchedProducts, matchedEmployees] = await Promise.all([
      db
        .select({ id: leads.id, name: leads.name, company: leads.company, status: leads.status, source: leads.source })
        .from(leads)
        .where(
          and(
            eq(leads.businessId, businessId),
            or(ilike(leads.name, pattern), ilike(leads.company, pattern), ilike(leads.email, pattern))
          )
        )
        .limit(5),
      db
        .select({ id: customers.id, name: customers.name, company: customers.company, status: customers.status })
        .from(customers)
        .where(
          and(
            eq(customers.businessId, businessId),
            or(ilike(customers.name, pattern), ilike(customers.company, pattern))
          )
        )
        .limit(5),
      db
        .select({ id: products.id, name: products.name, category: products.category, price: products.price, sku: products.sku })
        .from(products)
        .where(
          and(
            eq(products.businessId, businessId),
            or(ilike(products.name, pattern), ilike(products.sku, pattern), ilike(products.category, pattern))
          )
        )
        .limit(5),
      db
        .select({ id: users.id, fullName: users.fullName, email: users.email, role: users.role })
        .from(users)
        .where(
          and(
            eq(users.businessId, businessId),
            or(ilike(users.fullName, pattern), ilike(users.email, pattern))
          )
        )
        .limit(5),
    ]);

    res.json({
      leads: matchedLeads,
      customers: matchedCustomers,
      products: matchedProducts,
      employees: matchedEmployees,
    });
  } catch (error) {
    next(error);
  }
});
