import { profileForZoom } from './profile.js';

export interface TileQuery {
  text: string;
  values: unknown[];
}

export function buildTileQuery(
  zoom: number,
  x: number,
  y: number,
  sportType?: string,
): TileQuery {
  const profile = profileForZoom(zoom);
  const routeLayerSql = profile.includeRoutes
    ? `
      , route_features AS (
          SELECT
            row_number() OVER ()::bigint AS feature_id,
            sport_type,
            ST_AsMVTGeom(
              ST_SimplifyPreserveTopology(
                ST_Intersection(a.geom_3857, p.query_bounds),
                p.simplify_meters
              ),
              p.tile_bounds,
              4096,
              128,
              true
            ) AS geom
          FROM activities a
          CROSS JOIN params p
          WHERE a.geom_3857 && p.query_bounds
            AND (p.sport_type IS NULL OR a.sport_type = p.sport_type)
        ), route_tile AS (
          SELECT COALESCE(ST_AsMVT(route_features, 'routes', 4096, 'geom', 'feature_id'), '\\x'::bytea) AS tile
          FROM route_features
          WHERE geom IS NOT NULL
        )
    `
    : `, route_tile AS (SELECT '\\x'::bytea AS tile)`;

  return {
    text: `
      WITH params AS (
        SELECT
          ST_TileEnvelope($1::integer, $2::integer, $3::integer) AS tile_bounds,
          ST_TileEnvelope($1::integer, $2::integer, $3::integer, margin => 0.0625) AS query_bounds,
          $4::double precision AS cell_meters,
          $5::double precision AS sample_meters,
          $6::double precision AS simplify_meters,
          $7::text AS sport_type
      ), sampled_points AS (
        SELECT ST_SnapToGrid((dumped).geom, p.cell_meters) AS geom
        FROM activities a
        CROSS JOIN params p
        CROSS JOIN LATERAL ST_DumpPoints(
          ST_Segmentize(
            ST_CollectionExtract(ST_Intersection(a.geom_3857, p.query_bounds), 2),
            p.sample_meters
          )
        ) AS dumped
        WHERE a.geom_3857 && p.query_bounds
          AND (p.sport_type IS NULL OR a.sport_type = p.sport_type)
      ), density_cells AS (
        SELECT geom, COUNT(*)::integer AS weight
        FROM sampled_points
        WHERE NOT ST_IsEmpty(geom)
        GROUP BY geom
      ), density_features AS (
        SELECT
          row_number() OVER ()::bigint AS id,
          weight,
          ST_AsMVTGeom(geom, p.tile_bounds, 4096, 256, true) AS geom
        FROM density_cells
        CROSS JOIN params p
      ), density_tile AS (
        SELECT COALESCE(ST_AsMVT(density_features, 'density', 4096, 'geom', 'id'), '\\x'::bytea) AS tile
        FROM density_features
        WHERE geom IS NOT NULL
      )
      ${routeLayerSql}
      SELECT density_tile.tile || route_tile.tile AS tile
      FROM density_tile, route_tile
    `,
    values: [
      zoom,
      x,
      y,
      profile.cellMeters,
      profile.sampleMeters,
      profile.simplifyMeters,
      sportType ?? null,
    ],
  };
}
