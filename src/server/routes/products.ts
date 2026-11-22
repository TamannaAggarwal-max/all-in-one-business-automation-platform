import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import { notifications, products } from '../../db/schema.ts';
import { type AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';

const router = Router();
router.use(requireAuth);

const categories = ['Apparel', 'Accessories', 'Home & Living', 'Beauty', 'Stationery', 'Other'] as const;
const statuses = ['Published', 'Draft', 'Out of Stock'] as const;

const productSchema = z.object({
  name: z.string().trim().min(2, 'Product name is required'),
  category: z.enum(categories).default('Other'),
  price: z.coerce.number().int().min(0, 'Price cannot be negative'),
  stock: z.coerce.number().int().min(0, 'Stock cannot be negative'),
  shortDescription: z.string().trim().optional().default(''),
  description: z.string().trim().optional().default(''),
  highlights: z.array(z.string()).optional().default([]),
  imageUrl: z.string().trim().optional().default(''),
  sku: z.string().trim().min(2, 'SKU is required'),
  status: z.enum(statuses).default('Published'),
});

router.get('/', requireRole('ADMIN', 'MANAGER', 'SALES_EMPLOYEE'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';

    const conditions = [eq(products.businessId, businessId)];
    if (category && category !== 'All') conditions.push(eq(products.category, category));
    if (status && status !== 'All') conditions.push(eq(products.status, status));
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(or(ilike(products.name, pattern), ilike(products.sku, pattern))!);
    }

    const rows = await db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(desc(products.createdAt));

    res.json({ products: rows });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid product payload' });
      return;
    }

    const computedStatus =
      parsed.data.stock === 0 && parsed.data.status === 'Published'
        ? 'Out of Stock'
        : parsed.data.status;

    const [created] = await db
      .insert(products)
      .values({
        businessId,
        name: parsed.data.name,
        category: parsed.data.category,
        price: parsed.data.price,
        stock: parsed.data.stock,
        shortDescription: parsed.data.shortDescription,
        description: parsed.data.description,
        highlights: parsed.data.highlights,
        imageUrl: parsed.data.imageUrl,
        sku: parsed.data.sku,
        status: computedStatus,
      })
      .returning();

    if (created.stock <= 8) {
      await db.insert(notifications).values({
        businessId,
        title: 'Low product stock alert',
        message: `${created.name} (${created.sku}) has ${created.stock} units in stock.`,
        category: 'STOCK',
        isRead: false,
        linkUrl: '/products',
      });
    }

    res.status(201).json({ product: created });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const id = String(req.params.id);
    const parsed = productSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid product update' });
      return;
    }

    const [existing] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.businessId, businessId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const nextStock = parsed.data.stock ?? existing.stock;
    let nextStatus = parsed.data.status ?? existing.status;
    if (nextStock === 0 && nextStatus === 'Published') {
      nextStatus = 'Out of Stock';
    } else if (nextStock > 0 && existing.stock === 0 && parsed.data.status === undefined && existing.status === 'Out of Stock') {
      nextStatus = 'Published';
    }

    const [updated] = await db
      .update(products)
      .set({
        ...parsed.data,
        stock: nextStock,
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(and(eq(products.id, id), eq(products.businessId, businessId)))
      .returning();

    if (updated.stock <= 8 && existing.stock > 8) {
      await db.insert(notifications).values({
        businessId,
        title: 'Low product stock alert',
        message: `${updated.name} (${updated.sku}) dropped to ${updated.stock} units.`,
        category: 'STOCK',
        isRead: false,
        linkUrl: '/products',
      });
    }

    res.json({ product: updated });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.authUser!.businessId;
    const id = String(req.params.id);
    const deleted = await db
      .delete(products)
      .where(and(eq(products.id, id), eq(products.businessId, businessId)))
      .returning({ id: products.id });

    if (deleted.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json({ deletedId: id });
  } catch (error) {
    next(error);
  }
});

export default router;
