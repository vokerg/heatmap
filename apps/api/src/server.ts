import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool } from './db/pool.js';
import { FileStore } from './db/file-store.js';
import { buildFileApp } from './file-app.js';

const config = loadConfig();
const pool = config.STORAGE_MODE === 'postgres' ? createPool(config) : undefined;
const store = config.STORAGE_MODE === 'file' ? await FileStore.open(config.DATA_FILE) : undefined;
const app = pool ? await buildApp(config, pool) : await buildFileApp(config, store!);

const close = async (signal: string): Promise<void> => {
  app.log.info({ signal }, 'Shutting down');
  await app.close();
  await pool?.end();
  await store?.close();
  process.exit(0);
};

process.on('SIGINT', () => void close('SIGINT'));
process.on('SIGTERM', () => void close('SIGTERM'));

await app.listen({ host: config.HOST, port: config.PORT });
