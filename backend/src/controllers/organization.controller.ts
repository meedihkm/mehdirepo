// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - ORGANIZATION CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from 'express';
import { db } from '../database';
import { organizations } from '../database/schema';
import { eq } from 'drizzle-orm';
import { AppError } from '../utils/errors';

// Route: orgRoutes.get('/')
export const get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId));

    if (!org) throw new AppError('Organisation non trouvée', 404);

    res.json({ success: true, data: org });
  } catch (error) {
    next(error);
  }
};

// Route: orgRoutes.put('/')
export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;
    const { name, address, phone, email, taxId, logo } = req.body;

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (taxId !== undefined) updateData.taxId = taxId;
    if (logo !== undefined) updateData.logo = logo;
    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(organizations)
      .set(updateData)
      .where(eq(organizations.id, organizationId))
      .returning();

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

// Route: orgRoutes.put('/settings')
export const updateSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;
    const { settings } = req.body;

    const [updated] = await db
      .update(organizations)
      .set({ settings, updatedAt: new Date() })
      .where(eq(organizations.id, organizationId))
      .returning();

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

// Route: orgRoutes.get('/dashboard')
export const dashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ 
      success: true, 
      data: { 
        message: 'Dashboard - à implémenter',
        timestamp: new Date().toISOString()
      } 
    });
  } catch (error) {
    next(error);
  }
};
