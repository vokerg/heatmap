# Heatmap

A self-hosted activity heatmap inspired by the behavior of Strava's global heatmap: dense activity corridors merge at low zoom, while individual route structure becomes visible as the map is zoomed in.

## What is implemented

- Angular 22 + MapLibre GL frontend.
- Node.js 24 + Fastify API.
- PostgreSQL/PostGIS activity storage.
- Zoom-dependent Mapbox Vector Tiles generated directly by PostGIS.
- Point-density heatmap layers for smooth joining at low zoom, plus a sharp route layer at street zoom.
- Deterministic sample activities around Værløse and Bagsværd, Denmark.
- Unit tests and Playwright visual-smoke tests.
- GitHub Actions that upload overview/detail screenshots as build artifacts.
- Docker Compose for a complete local stack.

## Quick start

Requirements: Node.js 24.15+ and npm. The default file-backed storage needs no
database installation.

```bash
cp .env.example .env
npm install
npm run db:setup
npm run db:migrate
npm run db:seed
npm run dev
```

This stores activities in `data/heatmap.json`, which is ignored by Git. In this
mode `db:setup` and `db:migrate` are safe no-ops; `db:seed` loads the bundled
deterministic sample data.

## PostgreSQL/PostGIS option

Set `STORAGE_MODE=postgres` in `.env`, set `DATABASE_URL` to your PostgreSQL
credentials, and install PostGIS for the same PostgreSQL version. Then
`db:setup` creates the database and verifies PostGIS; the configured role must
be allowed to create databases and extensions. Docker Compose remains available
as an alternative PostGIS server.

Open `http://localhost:4200`. The API listens on `http://localhost:3000`.

For an entirely containerized run:

```bash
docker compose up --build
```

Open `http://localhost:8080`.

## Useful commands

```bash
npm run check          # API typecheck + Angular production build
npm test               # API unit tests
npm run test:visual    # Playwright screenshots and smoke assertions
npm run db:migrate     # Apply PostGIS schema migrations
npm run db:seed        # Replace sample activities with deterministic seed data
npm run db:setup       # Create the configured database and verify PostGIS
```

## Heatmap behavior

The tile endpoint samples each activity line at a distance derived from meters-per-pixel for the requested zoom. Samples are snapped to a zoom-dependent grid and grouped into weighted points. MapLibre renders those points as a heatmap, which naturally joins nearby routes at lower zooms. From zoom 13 onward, a second MVT layer adds simplified activity lines for street-level sharpness.

This is intentionally an MVP query path. For a large personal Strava archive, the next scaling step is a materialized density pyramid populated during import; see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Data import

The initial API accepts GeoJSON `LineString` activities. The included sample file is `samples/activities.geojson`. GPX/FIT/Strava archive import is deliberately left as a follow-up so the rendering and storage model can stabilize first.

## Visual artifacts

The `visual` GitHub Actions job starts PostGIS, seeds the sample dataset, launches the API and Angular app, and stores two screenshots:

- `overview.png` — joined regional corridors.
- `detail.png` — street-level route structure.

Run the `Task runner` workflow manually with `visual` to create a fresh artifact without changing code.

## Contribution workflow

All work is done on branches and through pull requests. Every completed PR must be **squash merged** into `main`. See [AGENTS.md](AGENTS.md) for the handoff and task-registration rules.
