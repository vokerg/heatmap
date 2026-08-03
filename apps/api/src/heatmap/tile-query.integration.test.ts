import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { loadConfig } from '../config.js';
import { createPool } from '../db/pool.js';
import { buildTileQuery } from './tile-query.js';

describe('heatmap tile query against PostGIS', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = createPool(loadConfig());
  });

  afterAll(async () => {
    await pool.end();
  });

  it.each([
    { zoom: 10, x: 547, y: 320, layer: 'density' },
    { zoom: 15, x: 17_513, y: 10_240, layer: 'density and routes' },
  ])('returns a non-empty $layer tile at zoom $zoom', async ({ zoom, x, y }) => {
    const query = buildTileQuery(zoom, x, y);
    const result = await pool.query<{ tile: Buffer }>(query.text, query.values);
    const tile = result.rows[0]?.tile;

    expect(Buffer.isBuffer(tile)).toBe(true);
    expect(tile?.byteLength ?? 0).toBeGreaterThan(0);
  });
});
