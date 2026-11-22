import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  automationActions,
  automations,
  brandSettings,
  businesses,
  users,
} from '../../db/schema.ts';
import {
  type AuthRequest,
  requireAuth,
  signAppToken,
} from '../middleware/auth.ts';
import { ensureSeeded } from '../seed.ts';

const router = Router();

const registerSchema = z.object({
  businessName: z.string().trim().min(2, 'Business name must be at least 2 characters'),
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  email: z.string().trim().email('Valid email address is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  businessCategory: z.string().trim().min(2, 'Business category is required'),
});

const loginSchema = z.object({
  email: z.string().trim().email('Valid email address is required'),
  password: z.string().min(1, 'Password is required'),
});

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'business';
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

router.post('/register', async (req, res, next) => {
  try {
    await ensureSeeded();
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Validation failed' });
      return;
    }

    const email = parsed.data.email.toLowerCase();
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const slug = slugify(parsed.data.businessName);

    const [business] = await db
      .insert(businesses)
      .values({
        name: parsed.data.businessName,
        slug,
        category: parsed.data.businessCategory,
      })
      .returning();

    const [user] = await db
      .insert(users)
      .values({
        businessId: business.id,
        fullName: parsed.data.fullName,
        email,
        passwordHash,
        role: 'ADMIN',
        isActive: true,
      })
      .returning();

    await db.insert(brandSettings).values({
      businessId: business.id,
      businessName: parsed.data.businessName,
      tagline: 'Your Business, Automated.',
      primaryColor: '#0F172A',
      secondaryColor: '#0284C7',
      description: `${parsed.data.businessName} — ${parsed.data.businessCategory}`,
      category: parsed.data.businessCategory,
      bannerHeadline: `Welcome to ${parsed.data.businessName}`,
      bannerSubheadline: 'Explore our latest products and request instant support.',
      bannerCta: 'Browse Catalog',
    });

    const [defaultAuto] = await db
      .insert(automations)
      .values({
        businessId: business.id,
        name: 'New Lead Instant Follow-up',
        description: 'Automatically assigns a team member, drafts a reply, and schedules a follow-up.',
        triggerType: 'NEW_LEAD',
        status: 'ACTIVE',
      })
      .returning();

    await db.insert(automationActions).values([
      { automationId: defaultAuto.id, actionType: 'ASSIGN_EMPLOYEE', config: {}, orderIndex: 0 },
      { automationId: defaultAuto.id, actionType: 'SEND_AUTOREPLY', config: { tone: 'Friendly' }, orderIndex: 1 },
      { automationId: defaultAuto.id, actionType: 'CREATE_FOLLOWUP', config: { offsetDays: 1, type: 'WhatsApp' }, orderIndex: 2 },
      { automationId: defaultAuto.id, actionType: 'CREATE_NOTIFICATION', config: { title: 'New Lead Captured' }, orderIndex: 3 },
    ]);

    const token = signAppToken({
      id: user.id,
      businessId: business.id,
      email: user.email,
      role: user.role,
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        businessId: business.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        businessName: business.name,
        businessSlug: business.slug,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    await ensureSeeded();
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Validation failed' });
      return;
    }

    const email = parsed.data.email.toLowerCase();
    const rows = await db
      .select({
        id: users.id,
        businessId: users.businessId,
        email: users.email,
        fullName: users.fullName,
        passwordHash: users.passwordHash,
        role: users.role,
        isActive: users.isActive,
        businessName: businesses.name,
        businessSlug: businesses.slug,
      })
      .from(users)
      .innerJoin(businesses, eq(users.businessId, businesses.id))
      .where(eq(users.email, email))
      .limit(1);

    const user = rows[0];
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: 'This account has been deactivated' });
      return;
    }

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = signAppToken({
      id: user.id,
      businessId: user.businessId,
      email: user.email,
      role: user.role,
    });

    res.json({
      token,
      user: {
        id: user.id,
        businessId: user.businessId,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        businessName: user.businessName,
        businessSlug: user.businessSlug,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, (req: AuthRequest, res) => {
  res.json({ user: req.authUser });
});

export default router;
