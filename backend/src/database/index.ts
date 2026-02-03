// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - CONNEXION BASE DE DONNÉES
// PostgreSQL avec Drizzle ORM (via node-postgres)
// ═══════════════════════════════════════════════════════════════════════════════

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import * as schema from './schema';

// ═══════════════════════════════════════════════════════════════════════════════
// CONNEXION POSTGRESQL
// ═══════════════════════════════════════════════════════════════════════════════

let pool: Pool;
let db: ReturnType<typeof drizzle>;

export const initializeDatabase = async (): Promise<void> => {
  try {
    // Créer le pool de connexions
    pool = new Pool({
      connectionString: config.database.url,
      max: config.database.poolSize,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 10000,
    });

    // Tester la connexion
    await pool.query('SELECT 1');
    logger.info('Database connection established');

    // Initialiser Drizzle
    db = drizzle(pool, { 
      schema,
      logger: config.env === 'development',
    });

  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
};

export const closeDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    logger.info('Database connection closed');
  }
};

export { db, pool };

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
  sql: string,
  ...values: any[]
): Promise<T[]> => {
  const result = await pool.query(sql, values);
  return result.rows;
};

export default { initializeDatabase, closeDatabase, db, pool, transaction, raw };
