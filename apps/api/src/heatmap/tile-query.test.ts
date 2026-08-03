import { describe, expect, it } from 'vitest';
import { buildTileQuery } from './tile-query.js';

describe('buildTileQuery', () => {
  it('builds density-only tiles below street zoom', () => {
    const query = buildTileQuery(11, 1094, 638);
    expect(query.text).toContain("'density'");
    expect(query.text).not.toContain("ST_AsMVT(route_features, 'routes'");
    expect(query.values).toHaveLength(7);
  });

  it('adds the sharp route layer at zoom 13+', () => {
    const query = buildTileQuery(14, 8755, 5108, 'Ride');
    expect(query.text).toContain("ST_AsMVT(route_features, 'routes'");
    expect(query.values[6]).toBe('Ride');
  });
});
