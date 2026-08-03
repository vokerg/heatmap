import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

export async function registerHealthRoutes(
  app: FastifyInstance,
  pool: Pool,
): Promise<void> {
  app.get('/api/health', async () => {
    const result = await pool.query<{ now: string }>('SELECT now()::text AS now');
    return {
      status: 'ok',
      databaseTime: result.rows[0]?.now,
    };
  });

  app.get('/api/stats', async () => {
    const result = await pool.query<{
      activity_count: string;
      distance_m: string;
    }>(`
      SELECT
        COUNT(*)::text AS activity_count,
        COALESCE(SUM(distance_m), 0)::text AS distance_m
      FROM activities
    `);

    return {
      activityCount: Number(result.rows[0]?.activity_count ?? 0),
      distanceMeters: Number(result.rows[0]?.distance_m ?? 0),
    };
  });
}
