import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileStore, densifyCoordinates } from './file-store.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('file-backed heatmap storage', () => {
  it('densifies sparse routes so heatmap density is continuous', () => {
    const coordinates: [number, number][] = [
      [12.4, 55.77],
      [12.41, 55.77],
    ];

    expect(densifyCoordinates(coordinates, 100).length).toBeGreaterThan(6);
  });

  it('imports a batch with one disk write and deduplicates external IDs', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'heatmap-file-store-'));
    temporaryDirectories.push(directory);
    const store = await FileStore.open(join(directory, 'heatmap.json'));
    const activity = {
      externalId: 'upload:one',
      name: 'Uploaded route',
      sportType: 'Ride',
      startedAt: '2026-08-03T08:00:00.000Z',
      source: 'upload',
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [12.4, 55.77],
          [12.41, 55.77],
        ] as [number, number][],
      },
      metadata: {},
    };

    const [firstId] = await store.upsertMany([activity]);
    const [secondId] = await store.upsertMany([{ ...activity, name: 'Renamed route' }]);

    expect(secondId).toBe(firstId);
    expect(store.stats().activityCount).toBe(1);
    expect(store.list()[0]?.name).toBe('Renamed route');
    expect(
      store.geojson().features.filter(
        (feature) => feature.properties['kind'] === 'density',
      ).length,
    ).toBeGreaterThan(6);
  });
});
