import { Pool } from 'pg';
import type { AppConfig } from '../config.js';

export function createPool(config: Pick<AppConfig, 'DATABASE_URL'>): Pool {
  return new Pool({
    connectionString: config.DATABASE_URL,
    max: 12,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}
