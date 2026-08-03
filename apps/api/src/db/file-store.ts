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

interface FileData { activities: StoredActivity[] }

function distance(coordinates: [number, number][]): number {
  return coordinates.slice(1).reduce((total, coordinate, index) => {
    const [lng1, lat1] = coordinates[index]!;
    const [lng2, lat2] = coordinate;
    const radians = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * radians / 2) ** 2 + Math.cos(lat1 * radians) * Math.cos(lat2 * radians) * Math.sin((lng2 - lng1) * radians / 2) ** 2;
    return total + 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, 0);
}

export class FileStore {
  private data: FileData = { activities: [] };
  private constructor(private readonly path: string) {}

  static async open(file: string): Promise<FileStore> {
    const store = new FileStore(resolve(process.cwd(), file));
    try { store.data = JSON.parse(await readFile(store.path, 'utf8')) as FileData; } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await store.save();
    }
    return store;
  }

  async save(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, `${JSON.stringify(this.data, null, 2)}\n`, 'utf8');
  }

  async upsert(activity: Omit<StoredActivity, 'id' | 'distanceMeters'>): Promise<string> {
    const existing = activity.externalId ? this.data.activities.findIndex((item) => item.externalId === activity.externalId) : -1;
    const record: StoredActivity = { ...activity, id: existing >= 0 ? this.data.activities[existing]!.id : crypto.randomUUID(), distanceMeters: distance(activity.geometry.coordinates) };
    if (existing >= 0) this.data.activities[existing] = record; else this.data.activities.push(record);
    await this.save();
    return record.id;
  }

  list(bbox?: number[], limit = 100): StoredActivity[] {
    return this.data.activities.filter((activity) => !bbox || activity.geometry.coordinates.some(([lng, lat]) => lng >= bbox[0]! && lng <= bbox[2]! && lat >= bbox[1]! && lat <= bbox[3]!)).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit);
  }

  stats(): { activityCount: number; distanceMeters: number } {
    return { activityCount: this.data.activities.length, distanceMeters: this.data.activities.reduce((total, item) => total + item.distanceMeters, 0) };
  }

  async deleteSource(source: string): Promise<void> {
    this.data.activities = this.data.activities.filter((activity) => activity.source !== source);
    await this.save();
  }

  geojson(): object {
    return { type: 'FeatureCollection', features: this.data.activities.flatMap((activity) => [
      { type: 'Feature', properties: { kind: 'route', sportType: activity.sportType }, geometry: activity.geometry },
      ...activity.geometry.coordinates.map((coordinates) => ({ type: 'Feature', properties: { kind: 'density', weight: 1, sportType: activity.sportType }, geometry: { type: 'Point', coordinates } })),
    ]) };
  }

  async close(): Promise<void> {}
}
