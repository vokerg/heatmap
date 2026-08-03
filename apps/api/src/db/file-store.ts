import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export interface StoredActivity {
  id: string;
  externalId?: string;
  name: string;
  sportType: string;
  startedAt: string;
  source: string;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  metadata: Record<string, unknown>;
  distanceMeters: number;
}

export type NewStoredActivity = Omit<StoredActivity, 'id' | 'distanceMeters'>;

interface FileData {
  activities: StoredActivity[];
}

interface HeatmapFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry:
    | { type: 'LineString'; coordinates: [number, number][] }
    | { type: 'Point'; coordinates: [number, number] };
}

interface HeatmapFeatureCollection {
  type: 'FeatureCollection';
  features: HeatmapFeature[];
}

const EARTH_RADIUS_METERS = 6_371_000;
const DENSITY_SAMPLE_METERS = 80;

function segmentDistance(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number],
): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (lat2 - lat1) * radians;
  const longitudeDelta = (lng2 - lng1) * radians;
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(lat1 * radians) *
      Math.cos(lat2 * radians) *
      Math.sin(longitudeDelta / 2) ** 2;

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function routeDistance(coordinates: [number, number][]): number {
  return coordinates.slice(1).reduce(
    (total, coordinate, index) =>
      total + segmentDistance(coordinates[index]!, coordinate),
    0,
  );
}

export function densifyCoordinates(
  coordinates: [number, number][],
  maximumSegmentMeters = DENSITY_SAMPLE_METERS,
): [number, number][] {
  if (coordinates.length < 2) return [...coordinates];

  const sampled: [number, number][] = [coordinates[0]!];
  for (let index = 1; index < coordinates.length; index += 1) {
    const start = coordinates[index - 1]!;
    const end = coordinates[index]!;
    const steps = Math.max(1, Math.ceil(segmentDistance(start, end) / maximumSegmentMeters));

    for (let step = 1; step <= steps; step += 1) {
      const ratio = step / steps;
      sampled.push([
        start[0] + (end[0] - start[0]) * ratio,
        start[1] + (end[1] - start[1]) * ratio,
      ]);
    }
  }

  return sampled;
}

export class FileStore {
  private data: FileData = { activities: [] };

  private constructor(private readonly path: string) {}

  static async open(file: string): Promise<FileStore> {
    const store = new FileStore(resolve(process.cwd(), file));
    try {
      store.data = JSON.parse(await readFile(store.path, 'utf8')) as FileData;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await store.save();
    }
    return store;
  }

  async save(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, `${JSON.stringify(this.data, null, 2)}\n`, 'utf8');
  }

  async upsert(activity: NewStoredActivity): Promise<string> {
    return (await this.upsertMany([activity]))[0]!;
  }

  async upsertMany(activities: NewStoredActivity[]): Promise<string[]> {
    const ids: string[] = [];

    for (const activity of activities) {
      const existing = activity.externalId
        ? this.data.activities.findIndex(
            (item) => item.externalId === activity.externalId,
          )
        : -1;
      const record: StoredActivity = {
        ...activity,
        id: existing >= 0 ? this.data.activities[existing]!.id : crypto.randomUUID(),
        distanceMeters: routeDistance(activity.geometry.coordinates),
      };

      if (existing >= 0) this.data.activities[existing] = record;
      else this.data.activities.push(record);
      ids.push(record.id);
    }

    await this.save();
    return ids;
  }

  list(bbox?: number[], limit = 100): StoredActivity[] {
    return this.data.activities
      .filter(
        (activity) =>
          !bbox ||
          activity.geometry.coordinates.some(
            ([lng, lat]) =>
              lng >= bbox[0]! &&
              lng <= bbox[2]! &&
              lat >= bbox[1]! &&
              lat <= bbox[3]!,
          ),
      )
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit);
  }

  stats(): { activityCount: number; distanceMeters: number } {
    return {
      activityCount: this.data.activities.length,
      distanceMeters: this.data.activities.reduce(
        (total, item) => total + item.distanceMeters,
        0,
      ),
    };
  }

  async deleteSource(source: string): Promise<void> {
    this.data.activities = this.data.activities.filter(
      (activity) => activity.source !== source,
    );
    await this.save();
  }

  geojson(): HeatmapFeatureCollection {
    return {
      type: 'FeatureCollection',
      features: this.data.activities.flatMap((activity) => [
        {
          type: 'Feature' as const,
          properties: {
            kind: 'route',
            sportType: activity.sportType,
            activityId: activity.id,
          },
          geometry: activity.geometry,
        },
        ...densifyCoordinates(activity.geometry.coordinates).map(
          (coordinates): HeatmapFeature => ({
            type: 'Feature',
            properties: {
              kind: 'density',
              weight: 1,
              sportType: activity.sportType,
              activityId: activity.id,
            },
            geometry: { type: 'Point', coordinates },
          }),
        ),
      ]),
    };
  }

  async close(): Promise<void> {}
}
