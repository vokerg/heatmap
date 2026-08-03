CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text,
  sport_type text NOT NULL,
  name text NOT NULL,
  started_at timestamptz NOT NULL,
  source text NOT NULL,
  geom geometry(LineString, 4326) NOT NULL,
  geom_3857 geometry(LineString, 3857) NOT NULL,
  distance_m double precision NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activities_external_id_unique UNIQUE (external_id)
);

CREATE OR REPLACE FUNCTION sync_activity_geometry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF ST_SRID(NEW.geom) <> 4326 THEN
    RAISE EXCEPTION 'activities.geom must use SRID 4326';
  END IF;
  IF GeometryType(NEW.geom) <> 'LINESTRING' THEN
    RAISE EXCEPTION 'activities.geom must be a LineString';
  END IF;

  NEW.geom_3857 := ST_Transform(NEW.geom, 3857);
  NEW.distance_m := ST_Length(NEW.geom_3857);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS activities_sync_geometry ON activities;
CREATE TRIGGER activities_sync_geometry
BEFORE INSERT OR UPDATE OF geom ON activities
FOR EACH ROW EXECUTE FUNCTION sync_activity_geometry();

CREATE INDEX IF NOT EXISTS activities_geom_3857_gist
  ON activities USING gist (geom_3857);
CREATE INDEX IF NOT EXISTS activities_started_at_btree
  ON activities (started_at DESC);
CREATE INDEX IF NOT EXISTS activities_sport_type_btree
  ON activities (sport_type);
