// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - MIDDLEWARE D'ERREURS
// Gestion centralisée des erreurs
// ═══════════════════════════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, isOperationalError } from '../utils/errors';
import { logger } from '../utils/logger';
import { config } from '../config';

// ═══════════════════════════════════════════════════════════════════════════════
// NOT FOUND HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} non trouvée`,
    },
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Logger l'erreur
  if (!isOperationalError(error)) {
    logger.error({
      err: error,
      method: req.method,
      path: req.path,
      body: req.body,
      user: req.user?.id,
    }, 'Unhandled error');
  } else {
    logger.warn({
      code: (error as AppError).code,
      message: error.message,
      method: req.method,
      path: req.path,
    }, 'Operational error');
  }

  // Erreur de validation Zod
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Données invalides',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code,
        })),
      },
    });
    return;
  }

  // Erreur applicative
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
      },
    });
    return;
  }

  // Erreur PostgreSQL - contrainte unique
  if ((error as any).code === '23505') {
    res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'Cette ressource existe déjà',
      },
    });
    return;
  }

  // Erreur PostgreSQL - clé étrangère
  if ((error as any).code === '23503') {
    res.status(400).json({
      success: false,
      error: {
        code: 'FOREIGN_KEY_VIOLATION',
        message: 'Référence invalide vers une ressource inexistante',
      },
    });
    return;
  }

  // Erreur PostgreSQL - violation de contrainte
  if ((error as any).code === '23514') {
    res.status(400).json({
      success: false,
      error: {
        code: 'CHECK_VIOLATION',
        message: 'Les données ne respectent pas les contraintes',
      },
    });
    return;
  }

  // Erreur JWT
  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token invalide',
      },
    });
    return;
  }

  if (error.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Token expiré',
      },
    });
    return;
  }

  // Erreur inconnue
  const statusCode = 500;
  const response: any = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Une erreur interne est survenue',
    },
  };

  // En développement, inclure plus de détails
  if (config.env === 'development') {
    response.error.details = {
      message: error.message,
      stack: error.stack,
    };
  }

  res.status(statusCode).json(response);
};

// ═══════════════════════════════════════════════════════════════════════════════
// ASYNC HANDLER WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>;

export const asyncHandler = (fn: AsyncHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  notFoundHandler,
  errorHandler,
  asyncHandler,
};
