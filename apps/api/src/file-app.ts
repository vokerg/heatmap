import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  activityBatchSchema,
  activityInputSchema,
  boundsForActivities,
} from './activities/model.js';
import type { AppConfig } from './config.js';
import { FileStore } from './db/file-store.js';

function statusCodeFor(error: unknown): number {
  if (typeof error === 'object' && error !== null && 'issues' in error) return 400;
  return 500;
}

export async function buildFileApp(
  config: AppConfig,
  store: FileStore,
): Promise<FastifyInstance> {
  const app = Fastify({
    bodyLimit: 50 * 1024 * 1024,
    logger: { level: process.env['NODE_ENV'] === 'test' ? 'silent' : 'info' },
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

  app.get('/api/config', async () => ({ storageMode: 'file' }));
  app.get('/api/health', async () => ({
    status: 'ok',
    databaseTime: new Date().toISOString(),
  }));
  app.get('/api/stats', async () => store.stats());
  app.get('/api/heatmap.geojson', async () => store.geojson());

  app.get('/api/activities', async (request) => {
    const query = z
      .object({
        bbox: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(500).default(100),
      })
      .parse(request.query);
    const bbox = query.bbox?.split(',').map(Number);
    return { activities: store.list(bbox, query.limit) };
  });

  app.post('/api/activities', async (request, reply) => {
    const activity = activityInputSchema.parse(request.body);
    const id = await store.upsert({
      ...activity,
      startedAt: activity.startedAt ?? new Date().toISOString(),
    });
    return reply.code(201).send({ id });
  });

  app.post('/api/activities/batch', async (request, reply) => {
    const payload = activityBatchSchema.parse(request.body);
    const activities = payload.activities.map((activity) => ({
      ...activity,
      startedAt: activity.startedAt ?? new Date().toISOString(),
    }));
    const ids = await store.upsertMany(activities);

    return reply.code(201).send({
      imported: ids.length,
      ids,
      bounds: boundsForActivities(payload.activities),
    });
  });

  return app;
}
