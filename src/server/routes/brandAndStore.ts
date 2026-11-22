import { and, desc, eq, ne } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  activities,
  brandSettings,
  businesses,
  leads,
  products,
} from '../../db/schema.ts';
import { type AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { ensureSeeded } from '../seed.ts';
import { executeAutomations } from '../services/automationEngine.ts';

export const brandRouter = Router();
brandRouter.use(requireAuth);

const brandUpdateSchema = z.object({
  businessName: z.string().trim().min(2),
  tagline: z.string().trim().min(2),
  logoUrl: z.string().trim().optional().default(''),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a valid hex color'),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a valid hex color'),
  description: z.string().trim().optional().default(''),
  category: z.string().trim().min(2),
  bannerHeadline: z.string().trim().min(2),
  bannerSubheadline: z.string().trim().min(2),
  bannerCta: z.string().trim().min(2),
});

brandRouter.get('/', requireRole('ADMIN', 'MANAGER', 'SALES_EMPLOYEE'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const [brand] = await db
      .select()
      .from(brandSettings)
      .where(eq(brandSettings.businessId, businessId))
      .limit(1);

    res.json({ brand, businessSlug: req.authUser!.businessSlug });
  } catch (error) {
    next(error);
  }
});

brandRouter.put('/', requireRole('ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const parsed = brandUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid brand settings' });
      return;
    }

    const [updated] = await db
      .update(brandSettings)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(brandSettings.businessId, businessId))
      .returning();

    await db
      .update(businesses)
      .set({
        name: parsed.data.businessName,
        category: parsed.data.category,
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, businessId));

    res.json({ brand: updated });
  } catch (error) {
    next(error);
  }
});

export const publicStoreRouter = Router();

publicStoreRouter.get('/:slug', async (req, res, next) => {
  try {
    await ensureSeeded();
    const slug = String(req.params.slug);

    const [biz] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.slug, slug))
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
        id: products.id,
        name: products.name,
        category: products.category,
        price: products.price,
        stock: products.stock,
        shortDescription: products.shortDescription,
        description: products.description,
        highlights: products.highlights,
        imageUrl: products.imageUrl,
        sku: products.sku,
        status: products.status,
      })
      .from(products)
      .where(and(eq(products.businessId, biz.id), ne(products.status, 'Draft')))
      .orderBy(desc(products.createdAt));

    res.json({
      business: {
        name: biz.name,
        slug: biz.slug,
        category: biz.category,
      },
      brand,
      products: catalog,
    });
  } catch (error) {
    next(error);
  }
});

publicStoreRouter.post('/:slug/inquire', async (req, res, next) => {
  try {
    await ensureSeeded();
    const slug = String(req.params.slug);
    const schema = z.object({
      name: z.string().trim().min(2, 'Name is required'),
      phone: z.string().trim().min(7, 'Phone number is required'),
      email: z.string().trim().email('Valid email required').or(z.literal('')).optional().default(''),
      notes: z.string().trim().min(2, 'Please describe your order or inquiry'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid inquiry' });
      return;
    }

    const [biz] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.slug, slug))
      .limit(1);

    if (!biz) {
      res.status(404).json({ error: 'Storefront not found' });
      return;
    }

    const [createdLead] = await db
      .insert(leads)
      .values({
        businessId: biz.id,
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email || '',
        company: 'Storefront Order Inquiry',
        source: 'Website Form',
        status: 'New',
        notes: parsed.data.notes,
        isSimulated: false,
      })
      .returning();

    await db.insert(activities).values({
      businessId: biz.id,
      leadId: createdLead.id,
      type: 'LEAD_CREATED',
      title: 'Storefront Inquiry Received',
      description: parsed.data.notes,
    });

    await executeAutomations({
      businessId: biz.id,
      triggerTypes: ['NEW_LEAD', 'WEBSITE_LEAD'],
      leadId: createdLead.id,
    });

    res.status(201).json({
      message: 'Your order inquiry has been received! Our team will reach out shortly.',
      referenceId: createdLead.id.slice(0, 8).toUpperCase(),
    });
  } catch (error) {
    next(error);
  }
});
