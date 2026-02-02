// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - MIDDLEWARE D'AUTHENTIFICATION
// JWT, rôles, et multi-tenant
// ═══════════════════════════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from 'express';
import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db } from '../database';
import { redis } from '../cache';
import { logger } from '../utils/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface JwtPayload {
  sub: string;          // User ID
  email: string;
  role: 'admin' | 'manager' | 'deliverer' | 'kitchen' | 'customer';
  organizationId: string;
  customerId?: string;  // Pour les clients (comptes customer_accounts)
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

export interface AuthenticatedUser {
  id: string;
  userId: string; // Alias pour id (compatibilité)
  email: string;
  role: string;
  organizationId: string;
  customerId?: string; // Pour les clients (comptes customer_accounts)
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      organizationId?: string;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GÉNÉRATION DE TOKENS
// ═══════════════════════════════════════════════════════════════════════════════

export const generateAccessToken = (user: {
  id: string;
  email: string;
  role: string;
  organizationId: string;
}): string => {
  const payload: Partial<JwtPayload> = {
    sub: user.id,
    email: user.email,
    role: user.role as JwtPayload['role'],
    organizationId: user.organizationId,
    type: 'access',
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
};

export const generateRefreshToken = (user: {
  id: string;
  email: string;
  role: string;
  organizationId: string;
}): string => {
  const payload: Partial<JwtPayload> = {
    sub: user.id,
    email: user.email,
    role: user.role as JwtPayload['role'],
    organizationId: user.organizationId,
    type: 'refresh',
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, config.jwt.secret, {
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  }) as JwtPayload;
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN BLACKLIST (Redis)
// ═══════════════════════════════════════════════════════════════════════════════

const BLACKLIST_PREFIX = 'token:blacklist:';

export const blacklistToken = async (token: string, expiresInSeconds: number): Promise<void> => {
  const key = `${BLACKLIST_PREFIX}${token}`;
  await redis.set(key, '1', 'EX', expiresInSeconds);
};

export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  const key = `${BLACKLIST_PREFIX}${token}`;
  const result = await redis.get(key);
  return result !== null;
};

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE: Authentification
// ═══════════════════════════════════════════════════════════════════════════════

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extraire le token du header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token d\'authentification requis',
        },
      });
      return;
    }

    const token = authHeader.substring(7);

    // Vérifier si le token est blacklisté
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_REVOKED',
          message: 'Token révoqué, veuillez vous reconnecter',
        },
      });
      return;
    }

    // Vérifier et décoder le token
    const payload = verifyToken(token);

    // Vérifier que c'est un access token
    if (payload.type !== 'access') {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN_TYPE',
          message: 'Type de token invalide',
        },
      });
      return;
    }

    // Vérifier que l'utilisateur existe toujours et est actif
    // Support pour les utilisateurs classiques et les comptes clients
    let user: any = null;
    let isCustomer = false;
    
    if (payload.role === 'customer') {
      // Vérifier dans customer_accounts
      const customerAccount = await db.query.customerAccounts?.findFirst({
        where: (ca: any, { eq, and }: any) => and(
          eq(ca.id, payload.sub),
          eq(ca.isActive, true)
        ),
      });
      if (customerAccount) {
        user = { id: customerAccount.id, isActive: true };
        isCustomer = true;
      }
    } else {
      // Vérifier dans users
      user = await db.query.users.findFirst({
        where: (users, { eq, and }) => and(
          eq(users.id, payload.sub),
          eq(users.isActive, true)
        ),
      });
    }

    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Utilisateur introuvable ou désactivé',
        },
      });
      return;
    }

    // Ajouter l'utilisateur à la requête
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      organizationId: payload.organizationId,
      customerId: isCustomer ? payload.customerId : undefined,
    };
    req.organizationId = payload.organizationId;

    // Configurer le RLS pour PostgreSQL
    await db.execute(`SET app.current_user_id = '${payload.sub}'`);
    await db.execute(`SET app.current_org_id = '${payload.organizationId}'`);

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token expiré, veuillez vous reconnecter',
        },
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token invalide',
        },
      });
      return;
    }

    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Erreur d\'authentification',
      },
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE: Autorisation par rôle
// ═══════════════════════════════════════════════════════════════════════════════

export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentification requise',
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Vous n\'avez pas les permissions nécessaires',
        },
      });
      return;
    }

    next();
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE: Authentification optionnelle
// ═══════════════════════════════════════════════════════════════════════════════

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  try {
    const token = authHeader.substring(7);
    const blacklisted = await isTokenBlacklisted(token);
    
    if (!blacklisted) {
      const payload = verifyToken(token);
      if (payload.type === 'access') {
        req.user = {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
          organizationId: payload.organizationId,
        };
        req.organizationId = payload.organizationId;
      }
    }
  } catch {
    // Token invalide, continuer sans authentification
  }

  next();
};

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHENTIFICATION SOCKET.IO
// ═══════════════════════════════════════════════════════════════════════════════

export const authenticateSocket = async (
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Token requis'));
    }

    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      return next(new Error('Token révoqué'));
    }

    const payload = verifyToken(token);

    if (payload.type !== 'access') {
      return next(new Error('Type de token invalide'));
    }

    // Stocker les infos utilisateur dans le socket
    socket.data.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      organizationId: payload.organizationId,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new Error('Token expiré'));
    }
    return next(new Error('Token invalide'));
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE: Vérification propriétaire ressource
// ═══════════════════════════════════════════════════════════════════════════════

export const checkResourceOwnership = (resourceType: 'order' | 'customer' | 'delivery') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentification requise' },
      });
      return;
    }

    // Admin et manager peuvent tout voir dans leur organisation
    if (['admin', 'manager'].includes(req.user.role)) {
      next();
      return;
    }

    const resourceId = req.params.id;

    // Vérifier selon le type de ressource
    let isOwner = false;

    switch (resourceType) {
      case 'order':
        // Livreur peut voir les commandes qui lui sont assignées
        if (req.user.role === 'deliverer') {
          const delivery = await db.query.deliveries.findFirst({
            where: (d, { eq, and }) => and(
              eq(d.orderId, resourceId),
              eq(d.delivererId, req.user!.id)
            ),
          });
          isOwner = !!delivery;
        }
        // Client peut voir ses propres commandes
        if (req.user.role === 'customer') {
          const order = await db.query.orders.findFirst({
            where: (o, { eq }) => eq(o.id, resourceId),
            with: { customer: true },
          });
          // Vérifier via customer_accounts
          // isOwner = order?.customer?.accountId === req.user.id;
        }
        break;

      case 'delivery':
        // Livreur peut voir ses propres livraisons
        if (req.user.role === 'deliverer') {
          const delivery = await db.query.deliveries.findFirst({
            where: (d, { eq, and }) => and(
              eq(d.id, resourceId),
              eq(d.delivererId, req.user!.id)
            ),
          });
          isOwner = !!delivery;
        }
        break;

      case 'customer':
        // Client peut voir son propre profil
        if (req.user.role === 'customer') {
          // Vérifier via customer_accounts
        }
        break;
    }

    if (!isOwner && !['admin', 'manager'].includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Vous n\'avez pas accès à cette ressource',
        },
      });
      return;
    }

    next();
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE: Vérification rôle client
// ═══════════════════════════════════════════════════════════════════════════════

export const requireCustomer = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || req.user.role !== 'customer') {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Accès réservé aux clients',
      },
    });
    return;
  }
  next();
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  authenticate,
  authorize,
  optionalAuth,
  authenticateSocket,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  blacklistToken,
  isTokenBlacklisted,
  checkResourceOwnership,
  requireCustomer,
};
