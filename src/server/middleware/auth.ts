import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { businesses, users } from '../../db/schema.ts';
import { adminAuth } from '../../lib/firebase-admin.ts';
import { ensureSeeded } from '../seed.ts';

const EPHEMERAL_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

export function getJwtSecret(): string {
  return process.env.JWT_SECRET?.trim() || EPHEMERAL_FALLBACK_SECRET;
}

export type UserRole = 'ADMIN' | 'MANAGER' | 'SALES_EMPLOYEE';

export interface AuthUser {
  id: string;
  businessId: string;
  email: string;
  fullName: string;
  role: UserRole;
  businessName: string;
  businessSlug: string;
}

export interface AuthRequest extends Request {
  authUser?: AuthUser;
}

export function signAppToken(user: {
  id: string;
  businessId: string;
  email: string;
  role: string;
}): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN?.trim() || '8h') as jwt.SignOptions['expiresIn'];
  return jwt.sign(
    {
      sub: user.id,
      businessId: user.businessId,
      email: user.email,
      role: user.role,
    },
    getJwtSecret(),
    { expiresIn }
  );
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Empty authentication token' });
    return;
  }

  try {
    await ensureSeeded();

    // 1. Try verifying our JWT token
    try {
      const payload = jwt.verify(token, getJwtSecret()) as {
        sub: string;
        businessId: string;
        email: string;
        role: string;
      };

      const rows = await db
        .select({
          id: users.id,
          businessId: users.businessId,
          email: users.email,
          fullName: users.fullName,
          role: users.role,
          isActive: users.isActive,
          businessName: businesses.name,
          businessSlug: businesses.slug,
        })
        .from(users)
        .innerJoin(businesses, eq(users.businessId, businesses.id))
        .where(eq(users.id, payload.sub))
        .limit(1);

      const user = rows[0];
      if (!user || !user.isActive) {
        res.status(401).json({ error: 'Unauthorized: Account inactive or not found' });
        return;
      }

      req.authUser = {
        id: user.id,
        businessId: user.businessId,
        email: user.email,
        fullName: user.fullName,
        role: user.role as UserRole,
        businessName: user.businessName,
        businessSlug: user.businessSlug,
      };
      next();
      return;
    } catch {
      // Not a valid app JWT; fall through to Firebase ID Token verification
    }

    // 2. Verify Firebase ID Token (Google Sign-In)
    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email || '').toLowerCase();
    const uid = decoded.uid;

    if (!email) {
      res.status(401).json({ error: 'Unauthorized: Google account has no email address' });
      return;
    }

    // Look up existing user by uid or email
    let [existing] = await db
      .select({
        id: users.id,
        businessId: users.businessId,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        isActive: users.isActive,
        uid: users.uid,
        businessName: businesses.name,
        businessSlug: businesses.slug,
      })
      .from(users)
      .innerJoin(businesses, eq(users.businessId, businesses.id))
      .where(eq(users.uid, uid))
      .limit(1);

    if (!existing) {
      const byEmail = await db
        .select({
          id: users.id,
          businessId: users.businessId,
          email: users.email,
          fullName: users.fullName,
          role: users.role,
          isActive: users.isActive,
          uid: users.uid,
          businessName: businesses.name,
          businessSlug: businesses.slug,
        })
        .from(users)
        .innerJoin(businesses, eq(users.businessId, businesses.id))
        .where(eq(users.email, email))
        .limit(1);

      if (byEmail[0]) {
        existing = byEmail[0];
        await db
          .update(users)
          .set({ uid, updatedAt: new Date() })
          .where(eq(users.id, existing.id));
      }
    }

    if (!existing) {
      // Attach Google Sign-In user to the Atelier Nord workspace as ADMIN for seamless evaluation
      const [defaultBiz] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.slug, 'atelier-nord'))
        .limit(1);

      if (!defaultBiz) {
        res.status(500).json({ error: 'Default workspace unavailable' });
        return;
      }

      const [created] = await db
        .insert(users)
        .values({
          uid,
          businessId: defaultBiz.id,
          fullName: decoded.name || email.split('@')[0],
          email,
          role: 'ADMIN',
          isActive: true,
        })
        .onConflictDoUpdate({
          target: users.email,
          set: { uid, updatedAt: new Date() },
        })
        .returning();

      req.authUser = {
        id: created.id,
        businessId: created.businessId,
        email: created.email,
        fullName: created.fullName,
        role: created.role as UserRole,
        businessName: defaultBiz.name,
        businessSlug: defaultBiz.slug,
      };
      next();
      return;
    }

    if (!existing.isActive) {
      res.status(403).json({ error: 'Account has been deactivated by an administrator' });
      return;
    }

    req.authUser = {
      id: existing.id,
      businessId: existing.businessId,
      email: existing.email,
      fullName: existing.fullName,
      role: existing.role as UserRole,
      businessName: existing.businessName,
      businessSlug: existing.businessSlug,
    };
    next();
  } catch (error) {
    console.error('Authentication failure:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      res.status(403).json({
        error: `Forbidden: Role ${req.authUser.role} does not have permission for this resource`,
      });
      return;
    }
    next();
  };
}
