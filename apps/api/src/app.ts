import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { AppConfig } from './config.js';
import { registerActivityRoutes } from './routes/activities.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerTileRoutes } from './routes/tiles.js';

export async function buildApp(config: AppConfig, pool: Pool): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env['NODE_ENV'] === 'test' ? 'silent' : 'info',
    },
  });

  await app.register(cors, {
    origin: config.WEB_ORIGIN.split(',').map((origin) => origin.trim()),
  });

  app.setErrorHandler((error, _request, reply) => {
    const statusCode = 'issues' in error ? 400 : (error.statusCode ?? 500);
    void reply.code(statusCode).send({
      error: statusCode >= 500 ? 'Internal server error' : error.message,
    });
  });

  await registerHealthRoutes(app, pool);
  await registerActivityRoutes(app, pool);
  await registerTileRoutes(app, pool);

  return app;
}
