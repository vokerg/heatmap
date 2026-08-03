import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { buildTileQuery } from '../heatmap/tile-query.js';

const tileParametersSchema = z.object({
  z: z.coerce.number().int().min(6).max(18),
  x: z.coerce.number().int().nonnegative(),
  y: z.coerce.number().int().nonnegative(),
});

const tileQuerySchema = z.object({
  sport: z.string().min(1).max(80).optional(),
});

export async function registerTileRoutes(
  app: FastifyInstance,
  pool: Pool,
): Promise<void> {
  app.get('/api/tiles/:z/:x/:y.mvt', async (request, reply) => {
    const params = tileParametersSchema.parse(request.params);
    const query = tileQuerySchema.parse(request.query);
    const maximumCoordinate = 2 ** params.z - 1;

    if (params.x > maximumCoordinate || params.y > maximumCoordinate) {
      return reply.code(400).send({ error: 'Tile coordinate is outside the zoom grid.' });
    }

    const tileQuery = buildTileQuery(params.z, params.x, params.y, query.sport);
    const result = await pool.query<{ tile: Buffer }>(tileQuery.text, tileQuery.values);
    const tile = result.rows[0]?.tile ?? Buffer.alloc(0);

    return reply
      .header('Content-Type', 'application/vnd.mapbox-vector-tile')
      .header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
      .send(tile);
  });
}
