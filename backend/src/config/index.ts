// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - CONFIGURATION
// Toutes les variables d'environnement centralisées
// ═══════════════════════════════════════════════════════════════════════════════

import dotenv from 'dotenv';
import { z } from 'zod';

// Charger le fichier .env
dotenv.config();

// ═══════════════════════════════════════════════════════════════════════════════
// SCHÉMA DE VALIDATION DES VARIABLES D'ENVIRONNEMENT
// ═══════════════════════════════════════════════════════════════════════════════

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_URL: z.string().url().default('http://localhost:3000'),
  
  // Base de données
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:8080'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  
  // Sécurité
  MAX_LOGIN_ATTEMPTS: z.coerce.number().default(5),
  LOGIN_LOCKOUT_MINUTES: z.coerce.number().default(15),
  OTP_VALIDITY_MINUTES: z.coerce.number().default(5),
  
  // Notifications (optionnel)
  FCM_SERVER_KEY: z.string().optional(),
  SMS_API_KEY: z.string().optional(),
  SMS_API_URL: z.string().optional(),
  SMS_SENDER_ID: z.string().default('AWID'),
  
  // Email (optionnel)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  
  // Storage
  STORAGE_TYPE: z.enum(['local', 's3']).default('local'),
  STORAGE_PATH: z.string().default('./storage'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  
  // Logs
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

// Valider les variables d'environnement
const envParsed = envSchema.safeParse(process.env);

if (!envParsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(envParsed.error.format());
  process.exit(1);
}

const env = envParsed.data;

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION EXPORTÉE
// ═══════════════════════════════════════════════════════════════════════════════

export const config = {
  // Application
  env: env.NODE_ENV,
  port: env.PORT,
  apiUrl: env.API_URL,
  version: '3.0.0',
  
  // Base de données
  database: {
    url: env.DATABASE_URL,
    poolSize: env.NODE_ENV === 'production' ? 20 : 5,
  },
  
  // Redis
  redis: {
    url: env.REDIS_URL,
  },
  
  // JWT
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    issuer: 'awid-api',
    audience: 'awid-app',
  },
  
  // CORS
  cors: {
    origins: env.CORS_ORIGINS.split(',').map(s => s.trim()),
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
  },
  
  // Sécurité
  security: {
    maxLoginAttempts: env.MAX_LOGIN_ATTEMPTS,
    loginLockoutMinutes: env.LOGIN_LOCKOUT_MINUTES,
    otpValidityMinutes: env.OTP_VALIDITY_MINUTES,
    bcryptRounds: 12,
  },
  
  // Notifications
  notifications: {
    fcm: {
      serverKey: env.FCM_SERVER_KEY,
      enabled: !!env.FCM_SERVER_KEY,
    },
    sms: {
      apiKey: env.SMS_API_KEY,
      apiUrl: env.SMS_API_URL,
      senderId: env.SMS_SENDER_ID,
      enabled: !!env.SMS_API_KEY,
    },
  },
  
  // Email
  email: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    from: env.SMTP_FROM,
    enabled: !!env.SMTP_HOST,
  },
  
  // Storage
  storage: {
    type: env.STORAGE_TYPE,
    local: {
      path: env.STORAGE_PATH,
    },
    s3: {
      bucket: env.S3_BUCKET,
      region: env.S3_REGION,
      accessKey: env.S3_ACCESS_KEY,
      secretKey: env.S3_SECRET_KEY,
    },
  },
  
  // Logs
  logging: {
    level: env.LOG_LEVEL,
  },
  
  // Pagination par défaut
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
  
  // Business rules
  business: {
    defaultCreditLimit: 50000, // DZD
    defaultPaymentDelayDays: 30,
    debtAlertDays: 45,
    orderNumberPrefix: 'AWD',
  },
};

export default config;
