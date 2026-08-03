import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';

const activitySchema = z.object({
  externalId: z.string().min(1).max(200).optional(),
  name: z.string().min(1).max(300).default('Imported activity'),
  sportType: z.string().min(1).max(80).default('Ride'),
  startedAt: z.iso.datetime().optional(),
  source: z.string().min(1).max(80).default('geojson'),
  geometry: z.object({
    type: z.literal('LineString'),
    coordinates: z
      .array(z.tuple([z.number().gte(-180).lte(180), z.number().gte(-90).lte(90)]))
      .min(2),
  }),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

const bboxSchema = z
  .string()
  .transform((value) => value.split(',').map(Number))
  .refine(
    (values) =>
      values.length === 4 && values.every(Number.isFinite) && values[0]! < values[2]! && values[1]! < values[3]!,
    'bbox must be minLng,minLat,maxLng,maxLat',
  );

export async function registerActivityRoutes(
  app: FastifyInstance,
  pool: Pool,
): Promise<void> {
  app.post('/api/activities', async (request, reply) => {
    const activity = activitySchema.parse(request.body);
    const result = await pool.query<{ id: string }>(
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

    return reply.code(201).send({ id: result.rows[0]?.id });
  });

  app.get('/api/activities', async (request) => {
    const query = z
      .object({ bbox: bboxSchema.optional(), limit: z.coerce.number().int().min(1).max(500).default(100) })
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
      [bbox?.[0] ?? null, bbox?.[1] ?? null, bbox?.[2] ?? null, bbox?.[3] ?? null, query.limit],
    );

    return { activities: result.rows };
  });
}
