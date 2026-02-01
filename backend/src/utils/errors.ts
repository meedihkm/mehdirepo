// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - GESTION DES ERREURS
// Classes d'erreurs personnalisées
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// CLASSE D'ERREUR PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════════

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: any;

  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    // Capturer la stack trace
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERREURS SPÉCIFIQUES
// ═══════════════════════════════════════════════════════════════════════════════

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      'NOT_FOUND',
      id ? `${resource} avec l'ID ${id} introuvable` : `${resource} introuvable`,
      404
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentification requise') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Accès non autorisé') {
    super('FORBIDDEN', message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Trop de requêtes') {
    super('RATE_LIMIT_EXCEEDED', message, 429);
  }
}

export class InternalError extends AppError {
  constructor(message: string = 'Erreur interne du serveur') {
    super('INTERNAL_ERROR', message, 500, undefined, false);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERREURS MÉTIER SPÉCIFIQUES
// ═══════════════════════════════════════════════════════════════════════════════

export class CreditLimitExceededError extends AppError {
  constructor(currentDebt: number, creditLimit: number, orderAmount: number) {
    super(
      'CREDIT_LIMIT_EXCEEDED',
      `Limite de crédit dépassée. Dette actuelle: ${currentDebt} DZD, Limite: ${creditLimit} DZD`,
      400,
      { currentDebt, creditLimit, orderAmount }
    );
  }
}

export class InvalidStatusTransitionError extends AppError {
  constructor(currentStatus: string, newStatus: string) {
    super(
      'INVALID_STATUS_TRANSITION',
      `Impossible de passer de "${currentStatus}" à "${newStatus}"`,
      400,
      { currentStatus, newStatus }
    );
  }
}

export class OrderNotEditableError extends AppError {
  constructor(status: string) {
    super(
      'ORDER_NOT_EDITABLE',
      `La commande ne peut pas être modifiée (statut: ${status})`,
      400
    );
  }
}

export class CustomerHasDebtError extends AppError {
  constructor(customerId: string, debt: number) {
    super(
      'CUSTOMER_HAS_DEBT',
      `Impossible de supprimer le client: dette de ${debt} DZD`,
      400,
      { customerId, debt }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Vérifier si une erreur est opérationnelle
// ═══════════════════════════════════════════════════════════════════════════════

export const isOperationalError = (error: Error): boolean => {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  InternalError,
  CreditLimitExceededError,
  InvalidStatusTransitionError,
  OrderNotEditableError,
  CustomerHasDebtError,
  isOperationalError,
};
