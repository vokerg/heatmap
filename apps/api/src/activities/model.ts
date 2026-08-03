import { z } from 'zod';

const coordinateSchema = z.tuple([
  z.number().gte(-180).lte(180),
  z.number().gte(-90).lte(90),
]);

export const activityInputSchema = z.object({
  externalId: z.string().min(1).max(200).optional(),
  name: z.string().min(1).max(300).default('Imported activity'),
  sportType: z.string().min(1).max(80).default('Ride'),
  startedAt: z.iso.datetime().optional(),
  source: z.string().min(1).max(80).default('upload'),
  geometry: z.object({
    type: z.literal('LineString'),
    coordinates: z.array(coordinateSchema).min(2),
  }),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const activityBatchSchema = z.object({
  activities: z.array(activityInputSchema).min(1).max(5_000),
});

export type ActivityInput = z.infer<typeof activityInputSchema>;

export type ActivityBounds = [number, number, number, number];

export function boundsForActivities(activities: ActivityInput[]): ActivityBounds | null {
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  for (const activity of activities) {
    for (const [lng, lat] of activity.geometry.coordinates) {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    }
  }

  return Number.isFinite(minLng) ? [minLng, minLat, maxLng, maxLat] : null;
}
