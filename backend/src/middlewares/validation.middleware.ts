// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - MIDDLEWARE DE VALIDATION ZOD
// Validation automatique des requêtes avec messages d'erreur en français
// ═══════════════════════════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, ZodIssue } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidatedRequest<TBody = any, TQuery = any, TParams = any> extends Request {
  validatedBody: TBody;
  validatedQuery: TQuery;
  validatedParams: TParams;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMATAGE DES ERREURS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Traduit les codes d'erreur Zod en messages français
 */
function translateZodError(issue: ZodIssue): string {
  const field = issue.path.join('.');
  
  switch (issue.code) {
    case 'invalid_type':
      if (issue.received === 'undefined') {
        return `Le champ '${field}' est requis`;
      }
      return `Le champ '${field}' doit être de type ${issue.expected}`;
    
    case 'invalid_string':
      if (issue.validation === 'email') {
        return `Le champ '${field}' doit être un email valide`;
      }
      if (issue.validation === 'uuid') {
        return `Le champ '${field}' doit être un identifiant valide`;
      }
      if (issue.validation === 'url') {
        return `Le champ '${field}' doit être une URL valide`;
      }
      return `Le champ '${field}' est invalide`;
    
    case 'too_small':
      if (issue.type === 'string') {
        return `Le champ '${field}' doit contenir au moins ${issue.minimum} caractère(s)`;
      }
      if (issue.type === 'number') {
        return `Le champ '${field}' doit être supérieur ou égal à ${issue.minimum}`;
      }
      if (issue.type === 'array') {
        return `Le champ '${field}' doit contenir au moins ${issue.minimum} élément(s)`;
      }
      return issue.message;
    
    case 'too_big':
      if (issue.type === 'string') {
        return `Le champ '${field}' ne doit pas dépasser ${issue.maximum} caractère(s)`;
      }
      if (issue.type === 'number') {
        return `Le champ '${field}' doit être inférieur ou égal à ${issue.maximum}`;
      }
      if (issue.type === 'array') {
        return `Le champ '${field}' ne doit pas contenir plus de ${issue.maximum} élément(s)`;
      }
      return issue.message;
    
    case 'invalid_enum_value':
      return `Le champ '${field}' doit être l'une des valeurs: ${issue.options.join(', ')}`;
    
    case 'invalid_literal':
      return `Le champ '${field}' doit être égal à '${issue.expected}'`;
    
    case 'custom':
      return issue.message;
    
    default:
      return issue.message;
  }
}

/**
 * Formate les erreurs Zod en format API standard
 */
function formatZodErrors(error: ZodError): ValidationError[] {
  return error.issues.map(issue => ({
    field: issue.path.join('.') || '_root',
    message: translateZodError(issue),
    code: issue.code,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARES DE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Valide le body de la requête
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.body);
      (req as ValidatedRequest).validatedBody = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Données invalides',
            details: formatZodErrors(error),
          },
        });
      }
      next(error);
    }
  };
}

/**
 * Valide les query params
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.query);
      (req as ValidatedRequest).validatedQuery = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Paramètres invalides',
            details: formatZodErrors(error),
          },
        });
      }
      next(error);
    }
  };
}

/**
 * Valide les params de route
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.params);
      (req as ValidatedRequest).validatedParams = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Paramètres de route invalides',
            details: formatZodErrors(error),
          },
        });
      }
      next(error);
    }
  };
}

/**
 * Valide body, query et params en une seule fois
 */
export function validate<TBody = any, TQuery = any, TParams = any>(options: {
  body?: ZodSchema<TBody>;
  query?: ZodSchema<TQuery>;
  params?: ZodSchema<TParams>;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const errors: ValidationError[] = [];
    
    try {
      if (options.params) {
        const validated = await options.params.parseAsync(req.params);
        (req as ValidatedRequest).validatedParams = validated;
      }
    } catch (error) {
      if (error instanceof ZodError) {
        errors.push(...formatZodErrors(error).map(e => ({
          ...e,
          field: `params.${e.field}`,
        })));
      }
    }
    
    try {
      if (options.query) {
        const validated = await options.query.parseAsync(req.query);
        (req as ValidatedRequest).validatedQuery = validated;
      }
    } catch (error) {
      if (error instanceof ZodError) {
        errors.push(...formatZodErrors(error).map(e => ({
          ...e,
          field: `query.${e.field}`,
        })));
      }
    }
    
    try {
      if (options.body) {
        const validated = await options.body.parseAsync(req.body);
        (req as ValidatedRequest).validatedBody = validated;
      }
    } catch (error) {
      if (error instanceof ZodError) {
        errors.push(...formatZodErrors(error));
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Données invalides',
          details: errors,
        },
      });
    }
    
    next();
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHÉMAS COMMUNS POUR LES ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().uuid('ID invalide'),
});

export const validateId = validateParams(idParamSchema);

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITAIRE: Validation manuelle
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Valide des données manuellement (utile dans les services)
 */
export async function validateData<T>(
  schema: ZodSchema<T>,
  data: unknown
): Promise<{ success: true; data: T } | { success: false; errors: ValidationError[] }> {
  try {
    const validated = await schema.parseAsync(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, errors: formatZodErrors(error) };
    }
    throw error;
  }
}

/**
 * Valide des données et lance une erreur si invalide
 */
export async function validateOrThrow<T>(schema: ZodSchema<T>, data: unknown): Promise<T> {
  return schema.parseAsync(data);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  validate,
  validateBody,
  validateQuery,
  validateParams,
  validateId,
  validateData,
  validateOrThrow,
};
