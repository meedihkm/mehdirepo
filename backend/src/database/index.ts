// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - CONNEXION BASE DE DONNÉES
// PostgreSQL avec Drizzle ORM
// ═══════════════════════════════════════════════════════════════════════════════

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config';
import { logger } from '../utils/logger';
import * as schema from './schema';

// ═══════════════════════════════════════════════════════════════════════════════
// CONNEXION POSTGRESQL
// ═══════════════════════════════════════════════════════════════════════════════

let client: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle>;

export const initializeDatabase = async (): Promise<void> => {
  try {
    // Créer la connexion
    client = postgres(config.database.url, {
      max: config.database.poolSize,
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: () => {}, // Ignorer les notices
    });

    // Initialiser Drizzle
    db = drizzle(client, { 
      schema,
      logger: config.env === 'development',
    });

    // Tester la connexion
    await client`SELECT 1`;
    logger.info('Database connection established');

  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
};

export const closeDatabase = async (): Promise<void> => {
  if (client) {
    await client.end();
    logger.info('Database connection closed');
  }
};

export { db, client };

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITAIRE: Transaction
// ═══════════════════════════════════════════════════════════════════════════════

export const transaction = async <T>(
  callback: (tx: typeof db) => Promise<T>
): Promise<T> => {
  return db.transaction(callback);
};

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITAIRE: Exécuter du SQL brut
// ═══════════════════════════════════════════════════════════════════════════════

export const raw = async <T = any>(
  sql: TemplateStringsArray,
  ...values: any[]
): Promise<T[]> => {
  return client(sql, ...values) as Promise<T[]>;
};

export default { initializeDatabase, closeDatabase, db, client, transaction, raw };
