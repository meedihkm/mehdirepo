// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - UTILITAIRES
// Logger, gestion d'erreurs, helpers
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// LOGGER (Pino)
// ═══════════════════════════════════════════════════════════════════════════════

import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: config.logging.level,
  transport: config.env === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined,
  base: {
    env: config.env,
    version: config.version,
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
});

export default logger;
