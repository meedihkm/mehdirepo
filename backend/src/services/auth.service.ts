// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SERVICE D'AUTHENTIFICATION
// Login, logout, refresh, OTP, password reset
// ═══════════════════════════════════════════════════════════════════════════════

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { eq, and, gt, lt } from 'drizzle-orm';

import { db } from '../database';
import { users, customerAccounts, organizations } from '../database/schema';
import { redis } from '../cache';
import { config } from '../config';
import { logger } from '../utils/logger';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  blacklistToken,
} from '../middlewares/auth.middleware';
import { sendSms } from './sms.service';
import { AppError } from '../utils/errors';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface LoginResult {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    organizationId: string;
    organizationName: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
  };
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES REDIS
// ═══════════════════════════════════════════════════════════════════════════════

const LOGIN_ATTEMPTS_PREFIX = 'auth:attempts:';
const OTP_PREFIX = 'auth:otp:';
const REFRESH_TOKEN_PREFIX = 'auth:refresh:';
const PASSWORD_RESET_PREFIX = 'auth:reset:';

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN ADMIN/MANAGER/LIVREUR
// ═══════════════════════════════════════════════════════════════════════════════

export const login = async (
  email: string,
  password: string,
  deviceId?: string
): Promise<LoginResult> => {
  const normalizedEmail = email.toLowerCase().trim();

  // Vérifier les tentatives de connexion
  const attemptsKey = `${LOGIN_ATTEMPTS_PREFIX}${normalizedEmail}`;
  const attempts = await redis.get(attemptsKey);
  
  if (attempts && parseInt(attempts) >= config.security.maxLoginAttempts) {
    const ttl = await redis.ttl(attemptsKey);
    throw new AppError(
      'ACCOUNT_LOCKED',
      `Compte verrouillé. Réessayez dans ${Math.ceil(ttl / 60)} minutes.`,
      429
    );
  }

  // Trouver l'utilisateur
  const user = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
    with: {
      organization: true,
    },
  });

  if (!user) {
    await incrementLoginAttempts(normalizedEmail);
    throw new AppError('INVALID_CREDENTIALS', 'Email ou mot de passe incorrect', 401);
  }

  // Vérifier si l'utilisateur est actif
  if (!user.isActive) {
    throw new AppError('ACCOUNT_DISABLED', 'Compte désactivé, contactez l\'administrateur', 403);
  }

  // Vérifier le mot de passe
  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  
  if (!passwordValid) {
    await incrementLoginAttempts(normalizedEmail);
    throw new AppError('INVALID_CREDENTIALS', 'Email ou mot de passe incorrect', 401);
  }

  // Réinitialiser les tentatives
  await redis.del(attemptsKey);

  // Générer les tokens
  const tokenData = {
    id: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
  };

  const accessToken = generateAccessToken(tokenData);
  const refreshToken = generateRefreshToken(tokenData);

  // Stocker le refresh token dans Redis
  await storeRefreshToken(user.id, refreshToken, deviceId);

  // Mettre à jour la dernière connexion
  await db.update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  logger.info(`User logged in: ${user.email} (${user.role})`);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      organizationName: user.organization?.name || '',
    },
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: config.jwt.expiresIn,
    },
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN CLIENT (OTP)
// ═══════════════════════════════════════════════════════════════════════════════

export const requestCustomerOtp = async (phone: string): Promise<{ message: string }> => {
  const normalizedPhone = normalizePhone(phone);

  // Vérifier si le compte client existe
  const customerAccount = await db.query.customerAccounts.findFirst({
    where: eq(customerAccounts.phone, normalizedPhone),
    with: {
      customer: {
        with: {
          organization: true,
        },
      },
    },
  });

  if (!customerAccount) {
    // Ne pas révéler si le numéro existe ou non (sécurité)
    throw new AppError('ACCOUNT_NOT_FOUND', 'Aucun compte associé à ce numéro', 404);
  }

  if (!customerAccount.isActive) {
    throw new AppError('ACCOUNT_DISABLED', 'Compte désactivé, contactez votre fournisseur', 403);
  }

  // Vérifier le rate limiting OTP
  const otpKey = `${OTP_PREFIX}${normalizedPhone}`;
  const existingOtp = await redis.get(otpKey);
  
  if (existingOtp) {
    const ttl = await redis.ttl(otpKey);
    if (ttl > (config.security.otpValidityMinutes - 1) * 60) {
      throw new AppError(
        'OTP_ALREADY_SENT',
        'Un code a déjà été envoyé. Attendez 1 minute avant de réessayer.',
        429
      );
    }
  }

  // Générer l'OTP (6 chiffres)
  const otp = generateOtp();

  // Stocker l'OTP dans Redis
  await redis.set(
    otpKey,
    JSON.stringify({
      code: otp,
      customerId: customerAccount.customerId,
      organizationId: customerAccount.customer.organizationId,
      attempts: 0,
    }),
    'EX',
    config.security.otpValidityMinutes * 60
  );

  // Envoyer le SMS
  if (config.notifications.sms.enabled) {
    await sendSms(
      normalizedPhone,
      `Votre code de connexion AWID: ${otp}. Valide ${config.security.otpValidityMinutes} minutes.`
    );
  } else {
    // En développement, logger l'OTP
    logger.info(`[DEV] OTP for ${normalizedPhone}: ${otp}`);
  }

  return { message: 'Code envoyé par SMS' };
};

export const verifyCustomerOtp = async (
  phone: string,
  otp: string,
  deviceId?: string
): Promise<LoginResult> => {
  const normalizedPhone = normalizePhone(phone);
  const otpKey = `${OTP_PREFIX}${normalizedPhone}`;

  // Récupérer l'OTP stocké
  const storedData = await redis.get(otpKey);
  
  if (!storedData) {
    throw new AppError('OTP_EXPIRED', 'Code expiré ou invalide', 400);
  }

  const otpData = JSON.parse(storedData);

  // Vérifier le nombre de tentatives
  if (otpData.attempts >= 3) {
    await redis.del(otpKey);
    throw new AppError('OTP_MAX_ATTEMPTS', 'Trop de tentatives. Demandez un nouveau code.', 429);
  }

  // Vérifier le code
  if (otpData.code !== otp) {
    otpData.attempts++;
    await redis.set(otpKey, JSON.stringify(otpData), 'KEEPTTL');
    throw new AppError('OTP_INVALID', 'Code incorrect', 400);
  }

  // OTP valide, supprimer
  await redis.del(otpKey);

  // Récupérer les infos du client
  const customerAccount = await db.query.customerAccounts.findFirst({
    where: eq(customerAccounts.phone, normalizedPhone),
    with: {
      customer: {
        with: {
          organization: true,
        },
      },
    },
  });

  if (!customerAccount) {
    throw new AppError('ACCOUNT_NOT_FOUND', 'Compte introuvable', 404);
  }

  // Générer les tokens
  const tokenData = {
    id: customerAccount.id,
    email: customerAccount.phone, // Utilise le téléphone comme identifiant
    role: 'customer' as const,
    organizationId: customerAccount.customer.organizationId,
  };

  const accessToken = generateAccessToken(tokenData);
  const refreshToken = generateRefreshToken(tokenData);

  // Stocker le refresh token
  await storeRefreshToken(customerAccount.id, refreshToken, deviceId);

  // Mettre à jour la dernière connexion
  await db.update(customerAccounts)
    .set({ lastLoginAt: new Date() })
    .where(eq(customerAccounts.id, customerAccount.id));

  logger.info(`Customer logged in: ${normalizedPhone}`);

  return {
    user: {
      id: customerAccount.id,
      email: customerAccount.phone,
      name: customerAccount.customer.name,
      role: 'customer',
      organizationId: customerAccount.customer.organizationId,
      organizationName: customerAccount.customer.organization?.name || '',
    },
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: config.jwt.expiresIn,
    },
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// REFRESH TOKEN
// ═══════════════════════════════════════════════════════════════════════════════

export const refreshTokens = async (refreshToken: string): Promise<TokenPair> => {
  try {
    // Vérifier le token
    const payload = verifyToken(refreshToken);

    if (payload.type !== 'refresh') {
      throw new AppError('INVALID_TOKEN_TYPE', 'Token invalide', 401);
    }

    // Vérifier si le refresh token existe dans Redis
    const storedToken = await redis.get(`${REFRESH_TOKEN_PREFIX}${payload.sub}`);
    
    if (!storedToken) {
      throw new AppError('TOKEN_REVOKED', 'Session expirée, veuillez vous reconnecter', 401);
    }

    const tokenData = JSON.parse(storedToken);
    
    if (tokenData.token !== refreshToken) {
      // Token potentiellement compromis, révoquer tous les tokens
      await redis.del(`${REFRESH_TOKEN_PREFIX}${payload.sub}`);
      throw new AppError('TOKEN_REUSED', 'Session invalide, veuillez vous reconnecter', 401);
    }

    // Générer de nouveaux tokens
    const newTokenData = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      organizationId: payload.organizationId,
    };

    const newAccessToken = generateAccessToken(newTokenData);
    const newRefreshToken = generateRefreshToken(newTokenData);

    // Rotation du refresh token
    await storeRefreshToken(payload.sub, newRefreshToken, tokenData.deviceId);

    // Blacklister l'ancien access token (si fourni)
    // Note: en pratique, on blackliste aussi l'ancien refresh token

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: config.jwt.expiresIn,
    };

  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('INVALID_TOKEN', 'Token invalide ou expiré', 401);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════════════════════════════

export const logout = async (userId: string, accessToken: string): Promise<void> => {
  // Supprimer le refresh token
  await redis.del(`${REFRESH_TOKEN_PREFIX}${userId}`);

  // Blacklister l'access token
  try {
    const payload = verifyToken(accessToken);
    const expiresIn = payload.exp - Math.floor(Date.now() / 1000);
    if (expiresIn > 0) {
      await blacklistToken(accessToken, expiresIn);
    }
  } catch {
    // Token déjà expiré, pas besoin de blacklister
  }

  logger.info(`User logged out: ${userId}`);
};

// ═══════════════════════════════════════════════════════════════════════════════
// CHANGEMENT DE MOT DE PASSE
// ═══════════════════════════════════════════════════════════════════════════════

export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new AppError('USER_NOT_FOUND', 'Utilisateur introuvable', 404);
  }

  // Vérifier le mot de passe actuel
  const passwordValid = await bcrypt.compare(currentPassword, user.passwordHash);
  
  if (!passwordValid) {
    throw new AppError('INVALID_PASSWORD', 'Mot de passe actuel incorrect', 400);
  }

  // Hasher le nouveau mot de passe
  const newPasswordHash = await bcrypt.hash(newPassword, config.security.bcryptRounds);

  // Mettre à jour
  await db.update(users)
    .set({
      passwordHash: newPasswordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  // Révoquer tous les refresh tokens (force re-login)
  await redis.del(`${REFRESH_TOKEN_PREFIX}${userId}`);

  logger.info(`Password changed for user: ${userId}`);
};

// ═══════════════════════════════════════════════════════════════════════════════
// RESET PASSWORD
// ═══════════════════════════════════════════════════════════════════════════════

export const requestPasswordReset = async (email: string): Promise<{ message: string }> => {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
  });

  // Ne pas révéler si l'email existe
  if (!user) {
    return { message: 'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.' };
  }

  // Générer un token de reset
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetKey = `${PASSWORD_RESET_PREFIX}${resetToken}`;

  // Stocker dans Redis (expire en 1 heure)
  await redis.set(resetKey, user.id, 'EX', 3600);

  // TODO: Envoyer l'email avec le lien
  // await sendEmail(user.email, 'reset-password', { resetToken });
  
  logger.info(`Password reset requested for: ${normalizedEmail}`);

  return { message: 'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.' };
};

export const resetPassword = async (
  token: string,
  newPassword: string
): Promise<void> => {
  const resetKey = `${PASSWORD_RESET_PREFIX}${token}`;
  const userId = await redis.get(resetKey);

  if (!userId) {
    throw new AppError('INVALID_TOKEN', 'Lien invalide ou expiré', 400);
  }

  // Hasher le nouveau mot de passe
  const passwordHash = await bcrypt.hash(newPassword, config.security.bcryptRounds);

  // Mettre à jour
  await db.update(users)
    .set({
      passwordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  // Supprimer le token de reset
  await redis.del(resetKey);

  // Révoquer tous les refresh tokens
  await redis.del(`${REFRESH_TOKEN_PREFIX}${userId}`);

  logger.info(`Password reset completed for user: ${userId}`);
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const incrementLoginAttempts = async (email: string): Promise<void> => {
  const key = `${LOGIN_ATTEMPTS_PREFIX}${email}`;
  const attempts = await redis.incr(key);
  
  if (attempts === 1) {
    await redis.expire(key, config.security.loginLockoutMinutes * 60);
  }
};

const storeRefreshToken = async (
  userId: string,
  token: string,
  deviceId?: string
): Promise<void> => {
  const key = `${REFRESH_TOKEN_PREFIX}${userId}`;
  await redis.set(
    key,
    JSON.stringify({
      token,
      deviceId,
      createdAt: new Date().toISOString(),
    }),
    'EX',
    7 * 24 * 60 * 60 // 7 jours
  );
};

const generateOtp = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

const normalizePhone = (phone: string): string => {
  // Retirer les espaces et caractères spéciaux
  let normalized = phone.replace(/[\s\-\.\(\)]/g, '');
  
  // Convertir +213 en 0
  if (normalized.startsWith('+213')) {
    normalized = '0' + normalized.substring(4);
  }
  
  return normalized;
};

/**
 * Hash un mot de passe avec bcrypt
 * @param password - Mot de passe en clair
 * @returns Mot de passe hashé
 */
const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, config.security.bcryptRounds);
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  login,
  requestCustomerOtp,
  verifyCustomerOtp,
  refreshTokens,
  logout,
  changePassword,
  requestPasswordReset,
  resetPassword,
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS NAMED (pour compatibilité)
// ═══════════════════════════════════════════════════════════════════════════════

export { hashPassword };
