import { and, asc, desc, eq, ilike, or } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import { activities, followUps, leads, users } from '../../db/schema.ts';
import { type AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { executeAutomations } from '../services/automationEngine.ts';
import { convertLeadToCustomerIfNeeded } from '../services/conversionService.ts';

const router = Router();
router.use(requireAuth);

const leadSources = ['WhatsApp', 'Call', 'Website Form', 'Instagram', 'Referral'] as const;
const leadStatuses = ['New', 'Contacted', 'Interested', 'Follow-up', 'Converted', 'Lost'] as const;

const createLeadSchema = z.object({
  name: z.string().trim().min(2, 'Lead name is required'),
  phone: z.string().trim().min(7, 'Valid phone number is required'),
  email: z.string().trim().email('Valid email required').or(z.literal('')).optional().default(''),
  company: z.string().trim().optional().default(''),
  source: z.enum(leadSources).default('WhatsApp'),
  status: z.enum(leadStatuses).default('New'),
  assignedUserId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().optional().default(''),
  nextFollowUpAt: z.string().nullable().optional(),
});

const updateLeadSchema = createLeadSchema.partial();

const SIMULATED_PROFILES = {
  WhatsApp: [
    {
      name: 'Riya Deshmukh',
      phone: '+91 98209 61234',
      email: 'riya@atelierbloom.in',
      company: 'Atelier Bloom',
      notes: 'WhatsApp inquiry (Demo): Looking for 15 Ceramic Pour-over sets and pricing for studio gifting.',
    },
    {
      name: 'Siddharth Menon',
      phone: '+91 98451 77820',
      email: 'siddharth@craftlane.co',
      company: 'Craftlane Studio',
      notes: 'WhatsApp inquiry (Demo): Asked about Everyday Tote bulk discount and delivery lead time.',
    },
  ],
  'Website Form': [
    {
      name: 'Tanya Bhatia',
      phone: '+91 99102 45910',
      email: 'tanya@nordicnest.in',
      company: 'Nordic Nest',
      notes: 'Website form submission (Demo): Requested wholesale catalog for Cloud Knit Set & Daily Journal.',
    },
    {
      name: 'Karanvir Gill',
      phone: '+91 98188 34021',
      email: 'karan@urbanhearth.in',
      company: 'Urban Hearth',
      notes: 'Website form submission (Demo): Interested in stocking Home & Living collection for Q1.',
    },
  ],
  Call: [
    {
      name: 'Pooja Sethi',
      phone: '+91 98711 29044',
      email: 'pooja@sethiretail.com',
      company: 'Sethi Retail Group',
      notes: 'Inbound call summary (Demo): Discussed trial order of 20 Everyday Totes for Delhi pop-up.',
    },
    {
      name: 'Nikhil Bansal',
      phone: '+91 98290 11205',
      email: 'nikhil@oakandlinen.in',
      company: 'Oak & Linen',
      notes: 'Inbound call summary (Demo): Wants callback with GST invoice and wholesale MOQ.',
    },
  ],
};

function sourceToTrigger(source: string): string {
  if (source === 'WhatsApp') return 'WHATSAPP_LEAD';
  if (source === 'Website Form') return 'WEBSITE_LEAD';
  if (source === 'Call') return 'CALL_LEAD';
  return 'NEW_LEAD';
}

router.get('/', requireRole('ADMIN', 'MANAGER', 'SALES_EMPLOYEE'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const source = typeof req.query.source === 'string' ? req.query.source.trim() : '';
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'newest';

    const conditions = [eq(leads.businessId, businessId)];
    if (status && status !== 'All') conditions.push(eq(leads.status, status));
    if (source && source !== 'All') conditions.push(eq(leads.source, source));
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(leads.name, pattern),
          ilike(leads.company, pattern),
          ilike(leads.email, pattern),
          ilike(leads.phone, pattern)
        )!
      );
    }

    const orderBy =
      sort === 'oldest'
        ? asc(leads.createdAt)
        : sort === 'name'
          ? asc(leads.name)
          : desc(leads.createdAt);

    const rows = await db
      .select({
        id: leads.id,
        businessId: leads.businessId,
        name: leads.name,
        phone: leads.phone,
        email: leads.email,
        company: leads.company,
        source: leads.source,
        status: leads.status,
        assignedUserId: leads.assignedUserId,
        assignedUserName: users.fullName,
        notes: leads.notes,
        nextFollowUpAt: leads.nextFollowUpAt,
        isSimulated: leads.isSimulated,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .leftJoin(users, eq(leads.assignedUserId, users.id))
      .where(and(...conditions))
      .orderBy(orderBy);

    res.json({ leads: rows });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireRole('ADMIN', 'MANAGER', 'SALES_EMPLOYEE'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const leadId = String(req.params.id);

    const [lead] = await db
      .select({
        id: leads.id,
        businessId: leads.businessId,
        name: leads.name,
        phone: leads.phone,
        email: leads.email,
        company: leads.company,
        source: leads.source,
        status: leads.status,
        assignedUserId: leads.assignedUserId,
        assignedUserName: users.fullName,
        notes: leads.notes,
        nextFollowUpAt: leads.nextFollowUpAt,
        isSimulated: leads.isSimulated,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .leftJoin(users, eq(leads.assignedUserId, users.id))
      .where(and(eq(leads.id, leadId), eq(leads.businessId, businessId)))
      .limit(1);

    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    const timeline = await db
      .select({
        id: activities.id,
        type: activities.type,
        title: activities.title,
        description: activities.description,
        metadata: activities.metadata,
        createdAt: activities.createdAt,
        userName: users.fullName,
      })
      .from(activities)
      .leftJoin(users, eq(activities.userId, users.id))
      .where(and(eq(activities.leadId, leadId), eq(activities.businessId, businessId)))
      .orderBy(desc(activities.createdAt));

    const leadFollowUps = await db
      .select()
      .from(followUps)
      .where(and(eq(followUps.leadId, leadId), eq(followUps.businessId, businessId)))
      .orderBy(desc(followUps.createdAt));

    res.json({ lead, activities: timeline, followUps: leadFollowUps });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('ADMIN', 'MANAGER', 'SALES_EMPLOYEE'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const parsed = createLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid lead details' });
      return;
    }

    const [created] = await db
      .insert(leads)
      .values({
        businessId,
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email || '',
        company: parsed.data.company || '',
        source: parsed.data.source,
        status: parsed.data.status,
        assignedUserId: parsed.data.assignedUserId || null,
        notes: parsed.data.notes || '',
        nextFollowUpAt: parsed.data.nextFollowUpAt ? new Date(parsed.data.nextFollowUpAt) : null,
        isSimulated: false,
      })
      .returning();

    await db.insert(activities).values({
      businessId,
      leadId: created.id,
      userId: req.authUser!.id,
      type: 'LEAD_CREATED',
      title: 'Lead Created',
      description: `Added manually from ${created.source} by ${req.authUser!.fullName}.`,
    });

    const triggerTypes = Array.from(new Set(['NEW_LEAD', sourceToTrigger(created.source)]));
    const automationTraces = await executeAutomations({
      businessId,
      triggerTypes,
      leadId: created.id,
      actorUserId: req.authUser!.id,
    });

    if (created.status === 'Converted') {
      await convertLeadToCustomerIfNeeded({
        businessId,
        lead: created,
        actorUserId: req.authUser!.id,
      });
    }

    const [freshLead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, created.id))
      .limit(1);

    res.status(201).json({ lead: freshLead, automationTraces });
  } catch (error) {
    next(error);
  }
});

router.post('/simulate', requireRole('ADMIN', 'MANAGER', 'SALES_EMPLOYEE'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const channelSchema = z.object({
      channel: z.enum(['WhatsApp', 'Website Form', 'Call']),
    });
    const parsed = channelSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid simulation channel' });
      return;
    }

    const profiles = SIMULATED_PROFILES[parsed.data.channel];
    const picked = profiles[Math.floor(Math.random() * profiles.length)];

    const [created] = await db
      .insert(leads)
      .values({
        businessId,
        name: picked.name,
        phone: picked.phone,
        email: picked.email,
        company: picked.company,
        source: parsed.data.channel,
        status: 'New',
        notes: picked.notes,
        isSimulated: true,
      })
      .returning();

    await db.insert(activities).values({
      businessId,
      leadId: created.id,
      userId: req.authUser!.id,
      type: 'LEAD_CREATED',
      title: 'Lead Created (Demo Simulation)',
      description: `Simulated ${parsed.data.channel} capture for ${created.name} (${created.company}).`,
      metadata: { simulated: true, channel: parsed.data.channel },
    });

    const triggerTypes = Array.from(new Set(['NEW_LEAD', sourceToTrigger(parsed.data.channel)]));
    const automationTraces = await executeAutomations({
      businessId,
      triggerTypes,
      leadId: created.id,
      actorUserId: req.authUser!.id,
    });

    const [freshLead] = await db
      .select({
        id: leads.id,
        businessId: leads.businessId,
        name: leads.name,
        phone: leads.phone,
        email: leads.email,
        company: leads.company,
        source: leads.source,
        status: leads.status,
        assignedUserId: leads.assignedUserId,
        assignedUserName: users.fullName,
        notes: leads.notes,
        nextFollowUpAt: leads.nextFollowUpAt,
        isSimulated: leads.isSimulated,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .leftJoin(users, eq(leads.assignedUserId, users.id))
      .where(eq(leads.id, created.id))
      .limit(1);

    res.status(201).json({ lead: freshLead, automationTraces });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireRole('ADMIN', 'MANAGER', 'SALES_EMPLOYEE'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const leadId = String(req.params.id);
    const parsed = updateLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid update payload' });
      return;
    }

    const [existing] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.businessId, businessId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
    if (parsed.data.email !== undefined) updates.email = parsed.data.email;
    if (parsed.data.company !== undefined) updates.company = parsed.data.company;
    if (parsed.data.source !== undefined) updates.source = parsed.data.source;
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;
    if (parsed.data.assignedUserId !== undefined) updates.assignedUserId = parsed.data.assignedUserId;
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
    if (parsed.data.nextFollowUpAt !== undefined) {
      updates.nextFollowUpAt = parsed.data.nextFollowUpAt ? new Date(parsed.data.nextFollowUpAt) : null;
    }

    const [updated] = await db
      .update(leads)
      .set(updates)
      .where(and(eq(leads.id, leadId), eq(leads.businessId, businessId)))
      .returning();

    if (parsed.data.assignedUserId && parsed.data.assignedUserId !== existing.assignedUserId) {
      const [assignee] = await db
        .select({ fullName: users.fullName })
        .from(users)
        .where(eq(users.id, parsed.data.assignedUserId))
        .limit(1);
      await db.insert(activities).values({
        businessId,
        leadId,
        userId: req.authUser!.id,
        type: 'EMPLOYEE_ASSIGNED',
        title: 'Employee Assigned',
        description: `Assigned to ${assignee?.fullName || 'team member'} by ${req.authUser!.fullName}.`,
      });
    }

    if (parsed.data.status && parsed.data.status !== existing.status) {
      await db.insert(activities).values({
        businessId,
        leadId,
        userId: req.authUser!.id,
        type: 'STATUS_CHANGED',
        title: `Status Changed to ${parsed.data.status}`,
        description: `Moved from ${existing.status} to ${parsed.data.status}.`,
      });

      await executeAutomations({
        businessId,
        triggerTypes: ['STATUS_CHANGED'],
        leadId,
        actorUserId: req.authUser!.id,
      });

      if (parsed.data.status === 'Converted') {
        await convertLeadToCustomerIfNeeded({
          businessId,
          lead: updated,
          actorUserId: req.authUser!.id,
        });
      }
    }

    res.json({ lead: updated });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/activities', requireRole('ADMIN', 'MANAGER', 'SALES_EMPLOYEE'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const leadId = String(req.params.id);
    const bodySchema = z.object({
      type: z.string().trim().default('CUSTOMER_CONTACTED'),
      title: z.string().trim().min(2),
      description: z.string().trim().min(1),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Activity title and description are required' });
      return;
    }

    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.businessId, businessId)))
      .limit(1);

    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    const [created] = await db
      .insert(activities)
      .values({
        businessId,
        leadId,
        userId: req.authUser!.id,
        type: parsed.data.type,
        title: parsed.data.title,
        description: parsed.data.description,
      })
      .returning();

    res.status(201).json({ activity: created });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const leadId = String(req.params.id);

    const deleted = await db
      .delete(leads)
      .where(and(eq(leads.id, leadId), eq(leads.businessId, businessId)))
      .returning({ id: leads.id });

    if (deleted.length === 0) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    res.json({ deletedId: leadId });
  } catch (error) {
    next(error);
  }
});

export default router;
