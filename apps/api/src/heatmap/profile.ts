const WEB_MERCATOR_METERS_PER_PIXEL_AT_ZOOM_ZERO = 156_543.033_928_040_97;

export interface HeatmapProfile {
  cellMeters: number;
  sampleMeters: number;
  simplifyMeters: number;
  includeRoutes: boolean;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function profileForZoom(zoom: number): HeatmapProfile {
  const metersPerPixel =
    WEB_MERCATOR_METERS_PER_PIXEL_AT_ZOOM_ZERO / 2 ** zoom;
  const cellMeters = clamp(metersPerPixel * 1.35, 2.5, 420);

  return {
    cellMeters,
    sampleMeters: clamp(cellMeters * 0.9, 3, 500),
    simplifyMeters: clamp(metersPerPixel * 0.45, 0.7, 120),
    includeRoutes: zoom >= 13,
  };
}
