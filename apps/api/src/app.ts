import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { AppConfig } from './config.js';
import { registerActivityRoutes } from './routes/activities.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerTileRoutes } from './routes/tiles.js';

function statusCodeFor(error: unknown): number {
  if (typeof error === 'object' && error !== null && 'issues' in error) return 400;

  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    if (typeof statusCode === 'number') return statusCode;
  }

  return 500;
}

export async function buildApp(config: AppConfig, pool: Pool): Promise<FastifyInstance> {
  const app = Fastify({
    bodyLimit: 50 * 1024 * 1024,
    logger: {
      level: process.env['NODE_ENV'] === 'test' ? 'silent' : 'info',
    },
  });

  await app.register(cors, {
    origin: config.WEB_ORIGIN.split(',').map((origin) => origin.trim()),
  });

  app.setErrorHandler((error: unknown, _request, reply) => {
    const statusCode = statusCodeFor(error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    void reply.code(statusCode).send({
      error: statusCode >= 500 ? 'Internal server error' : message,
    });
  });

  app.get('/api/config', async () => ({ storageMode: 'postgres' }));
  await registerHealthRoutes(app, pool);
  await registerActivityRoutes(app, pool);
  await registerTileRoutes(app, pool);

  return app;
}
