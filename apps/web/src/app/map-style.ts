import type { StyleSpecification } from 'maplibre-gl';

export function createMapStyle(
  visualMode: boolean,
  fileStorage = false,
  revision = 0,
): StyleSpecification {
  const basemapSources: StyleSpecification['sources'] = visualMode
    ? {
        reference: {
          type: 'geojson',
          data: '/assets/reference-map.geojson',
        },
      }
    : {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors',
        },
      };

  const basemapLayers: StyleSpecification['layers'] = visualMode
    ? [
        {
          id: 'parks',
          type: 'fill',
          source: 'reference',
          filter: ['==', ['get', 'kind'], 'park'],
          paint: { 'fill-color': '#b9dca9', 'fill-opacity': 0.78 },
        },
        {
          id: 'water',
          type: 'fill',
          source: 'reference',
          filter: ['==', ['get', 'kind'], 'water'],
          paint: { 'fill-color': '#8fc5df', 'fill-opacity': 0.95 },
        },
        {
          id: 'minor-roads',
          type: 'line',
          source: 'reference',
          filter: ['==', ['get', 'kind'], 'minor-road'],
          paint: {
            'line-color': '#ffffff',
            'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.7, 16, 4],
            'line-opacity': 0.9,
          },
        },
        {
          id: 'major-road-casing',
          type: 'line',
          source: 'reference',
          filter: ['==', ['get', 'kind'], 'major-road'],
          paint: {
            'line-color': '#c8cdd0',
            'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2.4, 16, 12],
          },
        },
        {
          id: 'major-roads',
          type: 'line',
          source: 'reference',
          filter: ['==', ['get', 'kind'], 'major-road'],
          paint: {
            'line-color': '#f6f6f3',
            'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.3, 16, 8],
          },
        },
        {
          id: 'rail',
          type: 'line',
          source: 'reference',
          filter: ['==', ['get', 'kind'], 'rail'],
          paint: {
            'line-color': '#90979b',
            'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.7, 16, 2.4],
            'line-dasharray': [2, 2],
          },
        },
      ]
    : [
        {
          id: 'osm',
          type: 'raster',
          source: 'osm',
          paint: { 'raster-saturation': -0.28, 'raster-opacity': 0.88 },
        },
      ];

  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      ...basemapSources,
      heatmap: fileStorage
        ? {
            type: 'geojson',
            data: `${window.location.origin}/api/heatmap.geojson?v=${revision}`,
          }
        : {
            type: 'vector',
            tiles: [
              `${window.location.origin}/api/tiles/{z}/{x}/{y}.mvt?v=${revision}`,
            ],
            minzoom: 6,
            maxzoom: 18,
          },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#e9ece8' },
      },
      ...basemapLayers,
      {
        id: 'heatmap-halo',
        type: 'heatmap',
        source: 'heatmap',
        ...(fileStorage ? {} : { 'source-layer': 'density' }),
        ...(fileStorage
          ? { filter: ['==', ['get', 'kind'], 'density'] }
          : {}),
        maxzoom: 17,
        paint: {
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'weight'], 0],
            0,
            0,
            3,
            0.35,
            18,
            1,
          ],
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7,
            0.85,
            13,
            1.15,
            16,
            1.3,
          ],
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7,
            5,
            11,
            9,
            15,
            11,
            17,
            12,
          ],
          'heatmap-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            6,
            0.72,
            13,
            0.58,
            15,
            0.32,
            17,
            0,
          ],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(80, 30, 210, 0)',
            0.12,
            'rgba(113, 44, 255, 0.16)',
            0.32,
            'rgba(105, 25, 245, 0.48)',
            0.62,
            'rgba(91, 0, 225, 0.82)',
            1,
            'rgba(64, 0, 176, 0.98)',
          ],
        },
      },
      {
        id: 'heatmap-core',
        type: 'heatmap',
        source: 'heatmap',
        ...(fileStorage ? {} : { 'source-layer': 'density' }),
        ...(fileStorage
          ? { filter: ['==', ['get', 'kind'], 'density'] }
          : {}),
        minzoom: 9,
        maxzoom: 17,
        paint: {
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'weight'], 0],
            0,
            0,
            2,
            0.5,
            12,
            1,
          ],
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            9,
            0.72,
            14,
            1.05,
            16,
            1.15,
          ],
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            9,
            2.5,
            13,
            5,
            16,
            7,
          ],
          'heatmap-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            9,
            0.75,
            14,
            0.5,
            16,
            0.18,
            17,
            0,
          ],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(120, 55, 255, 0)',
            0.24,
            'rgba(123, 55, 255, 0.3)',
            0.55,
            'rgba(95, 16, 235, 0.8)',
            1,
            'rgba(49, 0, 142, 1)',
          ],
        },
      },
      {
        id: 'route-glow',
        type: 'line',
        source: 'heatmap',
        ...(fileStorage ? {} : { 'source-layer': 'routes' }),
        ...(fileStorage ? { filter: ['==', ['get', 'kind'], 'route'] } : {}),
        minzoom: 13,
        paint: {
          'line-color': '#6b20ef',
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1, 18, 4.5],
          'line-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            13,
            0.12,
            16,
            0.3,
            18,
            0.42,
          ],
          'line-blur': ['interpolate', ['linear'], ['zoom'], 13, 0.4, 18, 1.7],
        },
      },
      {
        id: 'route-core',
        type: 'line',
        source: 'heatmap',
        ...(fileStorage ? {} : { 'source-layer': 'routes' }),
        ...(fileStorage ? { filter: ['==', ['get', 'kind'], 'route'] } : {}),
        minzoom: 14,
        paint: {
          'line-color': '#5010ca',
          'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.55, 18, 1.6],
          'line-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            14,
            0.32,
            18,
            0.68,
          ],
        },
      },
    ],
  };
}
