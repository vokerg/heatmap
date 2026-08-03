import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppConfig } from './config.js';
import { FileStore } from './db/file-store.js';

const activitySchema = z.object({
  externalId: z.string().min(1).max(200).optional(),
  name: z.string().min(1).max(300).default('Imported activity'),
  sportType: z.string().min(1).max(80).default('Ride'),
  startedAt: z.iso.datetime().optional(),
  source: z.string().min(1).max(80).default('geojson'),
  geometry: z.object({ type: z.literal('LineString'), coordinates: z.array(z.tuple([z.number().gte(-180).lte(180), z.number().gte(-90).lte(90)])).min(2) }),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export async function buildFileApp(config: AppConfig, store: FileStore): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: process.env['NODE_ENV'] === 'test' ? 'silent' : 'info' } });
  await app.register(cors, { origin: config.WEB_ORIGIN.split(',').map((origin) => origin.trim()) });
  app.get('/api/config', async () => ({ storageMode: 'file' }));
  app.get('/api/health', async () => ({ status: 'ok', databaseTime: new Date().toISOString() }));
  app.get('/api/stats', async () => store.stats());
  app.get('/api/heatmap.geojson', async () => store.geojson());
  app.get('/api/activities', async (request) => {
    const query = z.object({ bbox: z.string().optional(), limit: z.coerce.number().int().min(1).max(500).default(100) }).parse(request.query);
    const bbox = query.bbox?.split(',').map(Number);
    return { activities: store.list(bbox, query.limit) };
  });
  app.post('/api/activities', async (request, reply) => {
    const activity = activitySchema.parse(request.body);
    const id = await store.upsert({ ...activity, startedAt: activity.startedAt ?? new Date().toISOString() });
    return reply.code(201).send({ id });
  });
  return app;
}
