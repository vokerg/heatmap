import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { loadConfig } from '../config.js';
import { createPool } from './pool.js';
import { FileStore } from './file-store.js';

const featureCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(
    z.object({
      type: z.literal('Feature'),
      properties: z.record(z.string(), z.unknown()).default({}),
      geometry: z.object({
        type: z.literal('LineString'),
        coordinates: z.array(z.tuple([z.number(), z.number()])).min(2),
      }),
    }),
  ),
});

const currentDirectory = fileURLToPath(new URL('.', import.meta.url));
const samplePath = resolve(currentDirectory, '../../../../samples/activities.geojson');
const offsets = [
  [0, 0],
  [3, -2],
  [-4, 2],
  [7, 3],
  [-8, -4],
  [12, -6],
  [-13, 6],
  [18, 4],
  [-19, -5],
] as const;

async function seed(): Promise<void> {
  const sample = featureCollectionSchema.parse(
    JSON.parse(await readFile(samplePath, 'utf8')),
  );
  const config = loadConfig();
  if (config.STORAGE_MODE === 'file') {
    const store = await FileStore.open(config.DATA_FILE);
    await store.deleteSource('sample');
    let activityIndex = 0;
    for (const [routeIndex, feature] of sample.features.entries()) {
      for (const variantIndex of offsets.keys()) {
        activityIndex += 1;
        await store.upsert({
          externalId: `sample-${routeIndex + 1}-${variantIndex + 1}`,
          sportType: String(feature.properties['sportType'] ?? 'Ride'),
          name: String(feature.properties['name'] ?? `Route ${routeIndex + 1}`),
          startedAt: new Date(Date.UTC(2025, routeIndex % 12, variantIndex + 1)).toISOString(),
          source: 'sample',
          geometry: feature.geometry,
          metadata: { fixture: true, variant: variantIndex + 1 },
        });
      }
    }
    console.log(`Seeded ${activityIndex} deterministic file-backed sample activities.`);
    return;
  }
  const pool = createPool(config);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query("DELETE FROM activities WHERE source = 'sample'");

    let activityIndex = 0;
    for (const [routeIndex, feature] of sample.features.entries()) {
      for (const [variantIndex, [dx, dy]] of offsets.entries()) {
        activityIndex += 1;
        const externalId = `sample-${routeIndex + 1}-${variantIndex + 1}`;
        const startedAt = new Date(
          Date.UTC(2025, routeIndex % 12, 1 + variantIndex, 6 + (routeIndex % 8)),
        );
        const sportType = String(feature.properties['sportType'] ?? 'Ride');
        const routeName = String(feature.properties['name'] ?? `Route ${routeIndex + 1}`);

        await client.query(
          `
            WITH source_geom AS (
              SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS geom
            ), shifted AS (
              SELECT ST_Translate(ST_Transform(geom, 3857), $2, $3) AS geom_3857
              FROM source_geom
            )
            INSERT INTO activities (
              external_id, sport_type, name, started_at, source, geom, metadata
            )
            SELECT
              $4,
              $5,
              $6,
              $7,
              'sample',
              ST_Transform(geom_3857, 4326),
              jsonb_build_object('variant', $8::int, 'fixture', true)
            FROM shifted
            ON CONFLICT (external_id) DO UPDATE SET
              sport_type = EXCLUDED.sport_type,
              name = EXCLUDED.name,
              started_at = EXCLUDED.started_at,
              geom = EXCLUDED.geom,
              metadata = EXCLUDED.metadata
          `,
          [
            JSON.stringify(feature.geometry),
            dx,
            dy,
            externalId,
            sportType,
            `${routeName} ${variantIndex + 1}`,
            startedAt,
            variantIndex + 1,
          ],
        );
      }
    }

    await client.query('COMMIT');
    console.log(`Seeded ${activityIndex} deterministic sample activities.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
