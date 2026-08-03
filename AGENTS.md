# AGENTS.md

## Mission

Build a reliable, self-hosted activity heatmap with Strava-like zoom behavior. Preserve visual quality, predictable local operation, and an import path that can eventually handle a full Strava archive.

## Repository map

- `apps/api` — Fastify/TypeScript API, file store, and PostGIS tile queries.
- `apps/web` — Angular/MapLibre application and browser file parsers.
- `db/migrations` — ordered PostgreSQL/PostGIS schema migrations.
- `samples` — deterministic non-personal activity fixtures.
- `e2e` — Playwright visual and functional smoke tests.
- `.github/workflows` — CI and manually invokable registered tasks.
- `docs` — architecture and design decisions.

## Required workflow

1. Start from an up-to-date `main` and create a focused branch.
2. Keep the branch runnable and add tests for behavior changes.
3. Register every new executable task in root `package.json` and in a GitHub Actions workflow. Do not leave important ad-hoc commands only in prose.
4. Open a PR with screenshots or a link to the `heatmap-visual-artifacts` workflow artifact when rendering changes.
5. After review and green CI, **squash merge the PR into `main`**. All branches must be squash merged; do not use merge commits or rebase-merge for completed PRs.

## Local validation

```bash
npm install
npm run db:setup
npm run db:migrate
npm run db:seed
npm run check
npm test
npm run test:visual
```

The default `STORAGE_MODE=file` path does not require Docker. When validating PostgreSQL mode, start the Compose database and set `STORAGE_MODE=postgres` explicitly.

If the environment cannot install npm packages or run the browser tests, state that explicitly in the PR and rely on GitHub Actions for the missing checks. Never claim a visual result was inspected unless the generated artifact was actually opened.

## Rendering invariants

- Low zoom must emphasize aggregate corridors rather than individual GPS noise.
- File-backed density must sample along segments, not only at source vertices.
- High zoom must fade point heat and reveal route shape without becoming an opaque solid band.
- Tile seams must not be obvious; preserve query and MVT buffers together.
- Color/radius/intensity changes require refreshed overview and detail screenshots.
- The deterministic `?visual=1` basemap must remain network-independent for CI.

## Storage invariants

- The default file store is `data/heatmap.json`; never commit personal data from it.
- Imported activity external IDs must be deterministic so re-import is idempotent.
- Source geometry is WGS84 longitude/latitude.
- In PostGIS mode, tile/query geometry is Web Mercator (`SRID 3857`).
- Every PostgreSQL activity insert/update must keep both geometries synchronized through the database trigger.
- Spatial queries must use the GiST index on `geom_3857`.
- Do not put personal sample tracks in the repository or CI artifacts.

## Import invariants

- Browser import accepts multiple GPX, gzip-compressed GPX, and GeoJSON files.
- A GPX track segment is one activity; do not connect separate segments with artificial straight lines.
- Invalid or unsupported files must be reported without blocking valid files in the same selection.
- Keep batch API payloads bounded and test both deduplication and map refresh behavior.

## Near-term backlog

1. Add FIT parsing and direct Strava archive ZIP import.
2. Build a materialized multi-zoom density pyramid for large archives.
3. Add private-user authentication and activity visibility controls.
4. Add date, sport, and source filters to the tile cache key.
5. Compare visual artifacts against an approved baseline once the design is accepted.
