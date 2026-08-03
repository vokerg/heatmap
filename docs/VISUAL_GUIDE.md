# Visual quality guide

The target behavior is based on the supplied Strava heatmap references, without copying Strava branding or interface assets.

## Regional zoom

- Frequently used corridors read as continuous purple paths.
- Parallel GPS recordings should visually join instead of appearing as many hairlines.
- The strongest corridors have a darker core and a soft violet halo.
- Low-density routes remain visible but do not overpower the basemap.

## Street zoom

- Intersections and loops remain legible.
- Repeated activities produce a wider glow while the route center stays sharp.
- The effect must not obscure all road context beneath it.
- Tile boundaries must not create clipped circular heatmap edges.

## Assessment process

1. Run the `visual` CI job or the `Task runner` workflow with `visual`.
2. Download the `heatmap-visual-artifacts-*` artifact.
3. Inspect both `overview.png` and `detail.png` at 100% scale.
4. Record rendering changes in the PR and attach the artifact link.
5. Only introduce screenshot baselines after an initial design is explicitly accepted.
