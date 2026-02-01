// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - UTILITAIRES OTP
// Gestion des codes OTP pour l'authentification client
// ═══════════════════════════════════════════════════════════════════════════════

import { redisClient } from '../config/redis';
import crypto from 'crypto';

const OTP_PREFIX = 'otp:';
const OTP_EXPIRY = 300; // 5 minutes en secondes
const MAX_ATTEMPTS = 3;

/**
 * Génère un code OTP à 6 chiffres
 */
export async function generateOtp(phone: string): Promise<string> {
  // Générer un code à 6 chiffres
  const code = crypto.randomInt(100000, 999999).toString();

  const key = `${OTP_PREFIX}${phone}`;

  // Stocker dans Redis avec expiration
  await redisClient.setEx(key, OTP_EXPIRY, JSON.stringify({
    code,
    attempts: 0,
    createdAt: Date.now(),
  }));

  return code;
}

/**
 * Vérifie un code OTP
 */
export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const key = `${OTP_PREFIX}${phone}`;

  const data = await redisClient.get(key);
  if (!data) {
    return false;
  }

  const otpData = JSON.parse(data);

  // Vérifier le nombre de tentatives
  if (otpData.attempts >= MAX_ATTEMPTS) {
    await redisClient.del(key);
    return false;
  }

  // Incrémenter les tentatives
  otpData.attempts++;
  await redisClient.setEx(key, OTP_EXPIRY, JSON.stringify(otpData));

  // Vérifier le code
  if (otpData.code !== code) {
    return false;
  }

  // Code valide, supprimer l'OTP
  await redisClient.del(key);
  return true;
}

/**
 * Récupère les informations d'un OTP (pour debugging)
 */
export async function getOtpInfo(phone: string): Promise<any | null> {
  const key = `${OTP_PREFIX}${phone}`;
  const data = await redisClient.get(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Supprime un OTP
 */
export async function deleteOtp(phone: string): Promise<void> {
  const key = `${OTP_PREFIX}${phone}`;
  await redisClient.del(key);
}
