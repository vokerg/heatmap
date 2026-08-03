import type { FastifyInstance } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import {
  activityBatchSchema,
  activityInputSchema,
  boundsForActivities,
  type ActivityInput,
} from '../activities/model.js';

const bboxSchema = z
  .string()
  .transform((value) => value.split(',').map(Number))
  .refine(
    (values) =>
      values.length === 4 &&
      values.every(Number.isFinite) &&
      values[0]! < values[2]! &&
      values[1]! < values[3]!,
    'bbox must be minLng,minLat,maxLng,maxLat',
  );

type QueryClient = Pick<Pool | PoolClient, 'query'>;

async function upsertActivity(
  client: QueryClient,
  activity: ActivityInput,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO activities (
        external_id, name, sport_type, started_at, source, geom, metadata
      ) VALUES (
        $1, $2, $3, COALESCE($4::timestamptz, now()), $5,
        ST_SetSRID(ST_GeomFromGeoJSON($6), 4326),
        $7::jsonb
      )
      ON CONFLICT (external_id) DO UPDATE SET
        name = EXCLUDED.name,
        sport_type = EXCLUDED.sport_type,
        started_at = EXCLUDED.started_at,
        source = EXCLUDED.source,
        geom = EXCLUDED.geom,
        metadata = EXCLUDED.metadata
      RETURNING id::text
    `,
    [
      activity.externalId ?? null,
      activity.name,
      activity.sportType,
      activity.startedAt ?? null,
      activity.source,
      JSON.stringify(activity.geometry),
      JSON.stringify(activity.metadata),
    ],
  );

  return result.rows[0]!.id;
}

export async function registerActivityRoutes(
  app: FastifyInstance,
  pool: Pool,
): Promise<void> {
  app.post('/api/activities', async (request, reply) => {
    const activity = activityInputSchema.parse(request.body);
    const id = await upsertActivity(pool, activity);
    return reply.code(201).send({ id });
  });

  app.post('/api/activities/batch', async (request, reply) => {
    const payload = activityBatchSchema.parse(request.body);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const ids: string[] = [];
      for (const activity of payload.activities) {
        ids.push(await upsertActivity(client, activity));
      }
      await client.query('COMMIT');

      return reply.code(201).send({
        imported: ids.length,
        ids,
        bounds: boundsForActivities(payload.activities),
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/api/activities', async (request) => {
    const query = z
      .object({
        bbox: bboxSchema.optional(),
        limit: z.coerce.number().int().min(1).max(500).default(100),
      })
      .parse(request.query);

    const bbox = query.bbox;
    const result = await pool.query(
      `
        SELECT
          id::text,
          external_id AS "externalId",
          name,
          sport_type AS "sportType",
          started_at AS "startedAt",
          source,
          distance_m AS "distanceMeters"
        FROM activities
        WHERE (
          $1::double precision IS NULL OR
          geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
        )
        ORDER BY started_at DESC
        LIMIT $5
      `,
      [
        bbox?.[0] ?? null,
        bbox?.[1] ?? null,
        bbox?.[2] ?? null,
        bbox?.[3] ?? null,
        query.limit,
      ],
    );

    return { activities: result.rows };
  });
}
