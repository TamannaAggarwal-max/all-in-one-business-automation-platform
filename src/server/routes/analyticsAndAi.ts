import { and, eq, ne } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  automations,
  brandSettings,
  businesses,
  customers,
  followUps,
  leads,
  products,
  users,
} from '../../db/schema.ts';
import { type AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { ensureSeeded } from '../seed.ts';
import {
  answerStorefrontCustomerQuery,
  generateBannerCopy,
  generateBusinessInsights,
  generateCustomerReply,
  generateProductCopy,
} from '../services/geminiService.ts';

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

async function computeBusinessMetrics(businessId: string) {
  const [biz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  const [allLeads, allCustomers, allProducts, allFollowUps, allUsers, allAutos] =
    await Promise.all([
      db.select().from(leads).where(eq(leads.businessId, businessId)),
      db.select().from(customers).where(eq(customers.businessId, businessId)),
      db.select().from(products).where(eq(products.businessId, businessId)),
      db.select().from(followUps).where(eq(followUps.businessId, businessId)),
      db.select().from(users).where(eq(users.businessId, businessId)),
      db.select().from(automations).where(eq(automations.businessId, businessId)),
    ]);

  const totalLeads = allLeads.length;
  const newLeads = allLeads.filter((l) => l.status === 'New').length;
  const convertedLeads = allLeads.filter((l) => l.status === 'Converted').length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  const today = new Date().toISOString().slice(0, 10);
  const followUpsDue = allFollowUps.filter(
    (f) => f.status === 'Overdue' || (f.status === 'Pending' && f.dueDate <= today)
  ).length;
  const overdueFollowUps = allFollowUps.filter(
    (f) => f.status === 'Overdue' || (f.status === 'Pending' && f.dueDate < today)
  ).length;
  const pendingFollowUps = allFollowUps.filter((f) => f.status === 'Pending').length;
  const completedFollowUps = allFollowUps.filter((f) => f.status === 'Completed').length;

  const funnelOrder = ['New', 'Contacted', 'Interested', 'Follow-up', 'Converted'];
  const funnel = funnelOrder.map((stage) => ({
    stage,
    count: allLeads.filter((l) => l.status === stage).length,
  }));

  const sourceMap = new Map<string, { source: string; count: number; converted: number }>();
  for (const lead of allLeads) {
    const entry = sourceMap.get(lead.source) ?? { source: lead.source, count: 0, converted: 0 };
    entry.count += 1;
    if (lead.status === 'Converted') entry.converted += 1;
    sourceMap.set(lead.source, entry);
  }
  const leadSources = Array.from(sourceMap.values()).sort((a, b) => b.count - a.count);

  // Last 7 days trend computed from real createdAt timestamps
  const weeklyTrend: Array<{ day: string; leads: number; conversions: number }> = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayLeads = allLeads.filter((l) => l.createdAt.toISOString().slice(0, 10) === iso);
    weeklyTrend.push({
      day: label,
      leads: dayLeads.length,
      conversions: dayLeads.filter((l) => l.status === 'Converted').length,
    });
  }

  // Monthly grouped by week (W1-W4)
  const monthlyTrend = [3, 2, 1, 0].map((weeksBack, idx) => {
    const end = new Date();
    end.setDate(end.getDate() - weeksBack * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    const slice = allLeads.filter((l) => l.createdAt >= start && l.createdAt <= end);
    return {
      period: `Week ${idx + 1}`,
      leads: slice.length,
      conversions: slice.filter((l) => l.status === 'Converted').length,
    };
  });

  const followUpBreakdown = [
    { name: 'Completed', value: completedFollowUps },
    { name: 'Pending', value: pendingFollowUps },
    { name: 'Overdue', value: overdueFollowUps },
  ];

  const productPerformance = allProducts.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price: p.price,
    stock: p.stock,
    inventoryValue: p.price * p.stock,
    status: p.status,
  }));

  const employeePerformance = allUsers.map((u) => {
    const assigned = allLeads.filter((l) => l.assignedUserId === u.id);
    const contacted = assigned.filter((l) => l.status !== 'New').length;
    const conversions = assigned.filter((l) => l.status === 'Converted').length;
    const pendingTasks = allFollowUps.filter(
      (f) => f.assignedUserId === u.id && f.status !== 'Completed'
    ).length;
    return {
      id: u.id,
      fullName: u.fullName,
      role: u.role,
      leadsAssigned: assigned.length,
      leadsContacted: contacted,
      conversions,
      pendingFollowUps: pendingTasks,
    };
  });

  const lowStockProducts = allProducts
    .filter((p) => p.stock <= 10)
    .map((p) => ({ name: p.name, stock: p.stock }));

  const activeAutomations = allAutos.filter((a) => a.status === 'ACTIVE').length;

  return {
    businessName: biz?.name ?? 'BizPilot Business',
    summary: {
      totalLeads,
      newLeads,
      followUpsDue,
      overdueFollowUps,
      pendingFollowUps,
      completedFollowUps,
      convertedLeads,
      totalCustomers: allCustomers.length,
      totalProducts: allProducts.length,
      conversionRate,
      activeAutomations,
      followUpCompletionRate:
        allFollowUps.length > 0
          ? Math.round((completedFollowUps / allFollowUps.length) * 100)
          : 0,
    },
    funnel,
    leadSources,
    weeklyTrend,
    monthlyTrend,
    followUpBreakdown,
    productPerformance,
    employeePerformance,
    lowStockProducts,
  };
}

analyticsRouter.get('/', requireRole('ADMIN', 'MANAGER', 'SALES_EMPLOYEE'), async (req: AuthRequest, res, next) => {
  try {
    const metrics = await computeBusinessMetrics(req.authUser!.businessId);
    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

export const aiRouter = Router();

aiRouter.post('/generate-reply', requireAuth, requireRole('ADMIN', 'MANAGER', 'SALES_EMPLOYEE'), async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      customerMessage: z.string().trim().min(2, 'Customer message is required'),
      businessContext: z.string().trim().optional().default(''),
      leadName: z.string().trim().optional().default(''),
      tone: z.enum(['Professional', 'Friendly', 'Short', 'Sales-focused']).default('Friendly'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid reply request' });
      return;
    }

    const result = await generateCustomerReply({
      customerMessage: parsed.data.customerMessage,
      businessName: req.authUser!.businessName,
      businessContext: parsed.data.businessContext,
      leadName: parsed.data.leadName,
      tone: parsed.data.tone,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

aiRouter.post('/product-description', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      name: z.string().trim().min(2, 'Product name is required'),
      category: z.string().trim().default('Other'),
      features: z.string().trim().optional().default(''),
      targetAudience: z.string().trim().optional().default(''),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Product name is required' });
      return;
    }

    const result = await generateProductCopy(parsed.data);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

aiRouter.post('/banner-copy', requireAuth, requireRole('ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      campaign: z.string().trim().min(2, 'Campaign theme is required'),
      offer: z.string().trim().optional().default(''),
      targetAudience: z.string().trim().optional().default(''),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Campaign theme is required' });
      return;
    }

    const [brand] = await db
      .select()
      .from(brandSettings)
      .where(eq(brandSettings.businessId, req.authUser!.businessId))
      .limit(1);

    const result = await generateBannerCopy({
      campaign: parsed.data.campaign,
      offer: parsed.data.offer,
      targetAudience: parsed.data.targetAudience,
      businessName: brand?.businessName || req.authUser!.businessName,
      category: brand?.category || 'Retail',
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

aiRouter.post('/business-insights', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const metrics = await computeBusinessMetrics(req.authUser!.businessId);
    const result = await generateBusinessInsights({
      businessName: metrics.businessName,
      totalLeads: metrics.summary.totalLeads,
      convertedLeads: metrics.summary.convertedLeads,
      conversionRate: metrics.summary.conversionRate,
      overdueFollowUps: metrics.summary.overdueFollowUps,
      pendingFollowUps: metrics.summary.pendingFollowUps,
      completedFollowUps: metrics.summary.completedFollowUps,
      leadsBySource: metrics.leadSources,
      lowStockProducts: metrics.lowStockProducts,
      activeAutomations: metrics.summary.activeAutomations,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Public Storefront Chatbot
aiRouter.post('/chat', async (req, res, next) => {
  try {
    await ensureSeeded();
    const schema = z.object({
      businessSlug: z.string().trim().min(1),
      message: z.string().trim().min(1, 'Message cannot be empty'),
      history: z
        .array(
          z.object({
            role: z.enum(['user', 'assistant']),
            text: z.string(),
          })
        )
        .optional()
        .default([]),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid chat request' });
      return;
    }

    const [biz] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.slug, parsed.data.businessSlug))
      .limit(1);

    if (!biz) {
      res.status(404).json({ error: 'Storefront not found' });
      return;
    }

    const [brand] = await db
      .select()
      .from(brandSettings)
      .where(eq(brandSettings.businessId, biz.id))
      .limit(1);

    const catalog = await db
      .select({
        name: products.name,
        category: products.category,
        price: products.price,
        stock: products.stock,
        shortDescription: products.shortDescription,
        description: products.description,
        status: products.status,
      })
      .from(products)
      .where(and(eq(products.businessId, biz.id), ne(products.status, 'Draft')));

    const result = await answerStorefrontCustomerQuery({
      businessName: brand?.businessName || biz.name,
      tagline: brand?.tagline || '',
      description: brand?.description || '',
      products: catalog,
      message: parsed.data.message,
      history: parsed.data.history,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});
