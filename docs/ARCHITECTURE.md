# Architecture

## Rendering pipeline

1. Activities are stored as `LineString` geometries in both EPSG:4326 and EPSG:3857.
2. `/api/tiles/:z/:x/:y.mvt` computes the Web Mercator tile envelope with a buffer.
3. Intersecting tracks are clipped, segmentized, sampled, snapped to a grid, and grouped by location.
4. Grouped points are encoded as the MVT `density` layer with a `weight` property.
5. At zoom 13+, simplified lines are encoded as the MVT `routes` layer.
6. MapLibre draws a broad heatmap halo, a tighter heatmap core, and a faint sharp route line.

The sampling and snapping distances are derived from Web Mercator meters-per-pixel. This gives stable screen-space behavior and causes nearby tracks to coalesce as zoom decreases.

## Why vector tiles

PostGIS can create MVT directly with `ST_TileEnvelope`, `ST_AsMVTGeom`, and `ST_AsMVT`. The API therefore avoids serializing large GeoJSON payloads and lets the browser request only visible tiles. MVT buffers and query margins reduce visible seams.

## Current scaling boundary

The MVP calculates density from raw activity geometry per tile request. It is appropriate for sample data and a moderate personal archive, but repeated `ST_Segmentize` work will eventually dominate latency.

The production-scale design is a density pyramid:

- During import, sample each route once at a fixed fine resolution.
- Aggregate samples into `(zoom, cell_x, cell_y, sport, time_bucket)` rows.
- Increment/decrement counts transactionally when activities are added or deleted.
- Serve MVT directly from those cells and cache immutable tile variants.
- Retain the raw line table for detail zoom, activity inspection, and reprocessing.

## API surface

- `GET /api/health` — process and database health.
- `GET /api/stats` — activity count and aggregate distance.
- `GET /api/activities?bbox=minLng,minLat,maxLng,maxLat` — lightweight activity metadata.
- `POST /api/activities` — insert one GeoJSON `LineString` activity.
- `GET /api/tiles/:z/:x/:y.mvt` — density and route vector tile.

## Privacy

The current MVP has no authentication and is intended for local development only. Do not expose it publicly with personal tracks. Authentication, per-user ownership, and visibility filtering must precede any internet deployment.
