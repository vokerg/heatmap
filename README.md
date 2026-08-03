# Heatmap

A self-hosted activity heatmap inspired by the behavior of Strava's global heatmap: dense activity corridors merge at low zoom, while individual route structure becomes visible as the map is zoomed in.

## What is implemented

- Angular 22 + MapLibre GL frontend.
- Node.js 24 + Fastify API.
- No-setup JSON file storage by default, with PostgreSQL/PostGIS as an option.
- Zoom-dependent Mapbox Vector Tiles in PostGIS mode.
- Point-density heatmap layers for smooth joining at low zoom, plus a sharp route layer at street zoom.
- Multi-file GPX, gzip-compressed GPX, and GeoJSON import in the browser.
- Deterministic sample activities around Værløse and Bagsværd, Denmark.
- Unit tests and Playwright visual/functional smoke tests.
- GitHub Actions that upload overview/detail screenshots as build artifacts.

## Quick start

Requirements: Node.js 24.15+ and npm. The default file-backed storage needs no database installation.

```bash
cp .env.example .env
npm install
npm run db:setup
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:4200`. The API listens on `http://localhost:3000`.

Activities are stored in `data/heatmap.json`, which is ignored by Git. In file mode `db:setup` and `db:migrate` are safe no-ops; `db:seed` loads the bundled deterministic sample data.

## Importing real activities

Use **Import files** in the top bar. You can select many files at once.

Supported formats:

- `.gpx`
- `.gpx.gz`
- GeoJSON `.geojson` or `.json` containing `LineString` or `MultiLineString` features

The optional sport selector is used only when a file does not identify its sport. Re-importing the same file updates the existing imported activities instead of creating duplicates. After import, the map reloads its heatmap source and fits to the imported bounds.

FIT files and complete Strava archive ZIP files are not parsed yet. Export FIT activities as GPX for the current import path. Do not expose this application publicly with personal tracks; authentication is not implemented.

## PostgreSQL/PostGIS option

Set `STORAGE_MODE=postgres` in `.env`, set `DATABASE_URL` to your PostgreSQL credentials, and install PostGIS for the same PostgreSQL version. Then `db:setup` creates the database and verifies PostGIS; the configured role must be allowed to create databases and extensions. Docker Compose remains available as an alternative PostGIS server.

For an entirely containerized run:

```bash
docker compose up --build
```

Open `http://localhost:8080`.

## Useful commands

```bash
npm run check          # API typecheck + Angular production build
npm test               # API unit tests
npm run test:visual    # Playwright screenshots and browser import smoke test
npm run db:migrate     # Apply PostGIS schema migrations; no-op in file mode
npm run db:seed        # Replace sample activities with deterministic seed data
npm run db:setup       # Create/verify the configured database; no-op in file mode
```

## Heatmap behavior

In PostgreSQL mode, the tile endpoint samples each activity line at a distance derived from meters-per-pixel for the requested zoom. Samples are snapped to a zoom-dependent grid and grouped into weighted points. From zoom 13 onward, a second MVT layer adds simplified activity lines for street-level sharpness.

In file mode, the API densifies sparse activity geometry before emitting the GeoJSON density points. This prevents the vertex-only dots visible with the original synthetic fixture. At high zoom the density layers fade out so the route geometry remains legible.

A large personal archive will eventually require a materialized density pyramid rather than serving one large GeoJSON document or repeatedly sampling raw PostGIS geometry; see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Visual artifacts

The `visual` GitHub Actions job seeds the sample dataset, launches the API and Angular app, tests GPX import, and stores two screenshots:

- `overview.png` — joined regional corridors.
- `detail.png` — street-level route structure.

Run the `Task runner` workflow manually with `visual` to create a fresh artifact without changing code.

## Contribution workflow

All work is done on branches and through pull requests. Every completed PR must be **squash merged** into `main`. See [AGENTS.md](AGENTS.md) for the handoff and task-registration rules.
