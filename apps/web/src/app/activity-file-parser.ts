export interface UploadActivity {
  externalId: string;
  name: string;
  sportType: string;
  startedAt?: string;
  source: 'upload';
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  metadata: Record<string, unknown>;
}

export interface ActivityFileParseResult {
  activities: UploadActivity[];
  warnings: string[];
}

interface GeoJsonFeature {
  type: 'Feature';
  id?: string | number;
  properties?: Record<string, unknown> | null;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  } | null;
}

function elementsByLocalName(root: ParentNode, name: string): Element[] {
  return Array.from(root.querySelectorAll('*')).filter(
    (element) => element.localName === name,
  );
}

function firstText(root: ParentNode, name: string): string | undefined {
  return elementsByLocalName(root, name)[0]?.textContent?.trim() || undefined;
}

function normalizeSport(value: unknown, fallbackSport: string): string {
  const sport = String(value ?? '').trim().toLowerCase();
  if (sport.includes('run') || sport.includes('jog')) return 'Run';
  if (sport.includes('walk')) return 'Walk';
  if (sport.includes('hike')) return 'Hike';
  if (
    sport.includes('ride') ||
    sport.includes('cycl') ||
    sport.includes('bike')
  ) {
    return 'Ride';
  }
  return fallbackSport || 'Ride';
}

function optionalIsoDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function validCoordinate(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1]) &&
    value[0] >= -180 &&
    value[0] <= 180 &&
    value[1] >= -90 &&
    value[1] <= 90
  );
}

async function externalIdFor(
  fileName: string,
  index: number,
  startedAt: string | undefined,
  coordinates: [number, number][],
): Promise<string> {
  const identity = JSON.stringify({ fileName, index, startedAt, coordinates });
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(identity),
  );
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `upload:${hash}`;
}

async function readFileText(file: File): Promise<{ name: string; text: string }> {
  if (!file.name.toLowerCase().endsWith('.gz')) {
    return { name: file.name, text: await file.text() };
  }

  if (typeof DecompressionStream === 'undefined') {
    throw new Error(`${file.name}: this browser cannot decompress gzip files.`);
  }

  const decompressed = file
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  return {
    name: file.name.slice(0, -3),
    text: await new Response(decompressed).text(),
  };
}

async function parseGpx(
  fileName: string,
  text: string,
  fallbackSport: string,
): Promise<UploadActivity[]> {
  const document = new DOMParser().parseFromString(text, 'application/xml');
  if (elementsByLocalName(document, 'parsererror').length > 0) {
    throw new Error(`${fileName}: invalid GPX XML.`);
  }

  const activities: UploadActivity[] = [];
  const tracks = elementsByLocalName(document, 'trk');

  for (const [trackIndex, track] of tracks.entries()) {
    const segments = elementsByLocalName(track, 'trkseg');
    for (const [segmentIndex, segment] of segments.entries()) {
      const points = elementsByLocalName(segment, 'trkpt');
      const coordinates = points
        .map((point): [number, number] => [
          Number(point.getAttribute('lon')),
          Number(point.getAttribute('lat')),
        ])
        .filter(validCoordinate);
      if (coordinates.length < 2) continue;

      const startedAt = optionalIsoDate(firstText(points[0]!, 'time'));
      const index = trackIndex * 1_000 + segmentIndex;
      activities.push({
        externalId: await externalIdFor(fileName, index, startedAt, coordinates),
        name:
          firstText(track, 'name') ??
          `${fileName} track ${trackIndex + 1}${segments.length > 1 ? ` segment ${segmentIndex + 1}` : ''}`,
        sportType: normalizeSport(firstText(track, 'type'), fallbackSport),
        startedAt,
        source: 'upload',
        geometry: { type: 'LineString', coordinates },
        metadata: {
          fileName,
          format: 'gpx',
          trackIndex,
          segmentIndex,
        },
      });
    }
  }

  if (activities.length > 0) return activities;

  const routes = elementsByLocalName(document, 'rte');
  for (const [routeIndex, route] of routes.entries()) {
    const coordinates = elementsByLocalName(route, 'rtept')
      .map((point): [number, number] => [
        Number(point.getAttribute('lon')),
        Number(point.getAttribute('lat')),
      ])
      .filter(validCoordinate);
    if (coordinates.length < 2) continue;

    activities.push({
      externalId: await externalIdFor(fileName, routeIndex, undefined, coordinates),
      name: firstText(route, 'name') ?? `${fileName} route ${routeIndex + 1}`,
      sportType: normalizeSport(firstText(route, 'type'), fallbackSport),
      source: 'upload',
      geometry: { type: 'LineString', coordinates },
      metadata: { fileName, format: 'gpx', routeIndex },
    });
  }

  return activities;
}

function asFeatures(value: unknown): GeoJsonFeature[] {
  if (typeof value !== 'object' || value === null) return [];
  const candidate = value as {
    type?: unknown;
    features?: unknown;
    geometry?: unknown;
    properties?: unknown;
    id?: unknown;
  };

  if (candidate.type === 'FeatureCollection' && Array.isArray(candidate.features)) {
    return candidate.features.filter(
      (feature): feature is GeoJsonFeature =>
        typeof feature === 'object' &&
        feature !== null &&
        (feature as { type?: unknown }).type === 'Feature',
    );
  }

  if (candidate.type === 'Feature') return [candidate as GeoJsonFeature];

  if (candidate.type === 'LineString' || candidate.type === 'MultiLineString') {
    return [
      {
        type: 'Feature',
        properties: {},
        geometry: candidate as GeoJsonFeature['geometry'],
      },
    ];
  }

  return [];
}

async function parseGeoJson(
  fileName: string,
  text: string,
  fallbackSport: string,
): Promise<UploadActivity[]> {
  const features = asFeatures(JSON.parse(text) as unknown);
  const activities: UploadActivity[] = [];

  for (const [featureIndex, feature] of features.entries()) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    const lines: unknown[] =
      geometry.type === 'LineString'
        ? [geometry.coordinates]
        : geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates)
          ? geometry.coordinates
          : [];

    for (const [lineIndex, line] of lines.entries()) {
      if (!Array.isArray(line)) continue;
      const coordinates = line.filter(validCoordinate);
      if (coordinates.length < 2) continue;

      const properties = feature.properties ?? {};
      const startedAt = optionalIsoDate(
        properties['startedAt'] ??
          properties['started_at'] ??
          properties['time'] ??
          properties['date'],
      );
      const name = String(
        properties['name'] ??
          properties['title'] ??
          `${fileName} feature ${featureIndex + 1}`,
      );
      const index = featureIndex * 1_000 + lineIndex;
      activities.push({
        externalId: await externalIdFor(fileName, index, startedAt, coordinates),
        name,
        sportType: normalizeSport(
          properties['sportType'] ?? properties['sport'] ?? properties['type'],
          fallbackSport,
        ),
        startedAt,
        source: 'upload',
        geometry: { type: 'LineString', coordinates },
        metadata: {
          ...properties,
          fileName,
          format: 'geojson',
          featureId: feature.id,
          featureIndex,
          lineIndex,
        },
      });
    }
  }

  return activities;
}

export async function parseActivityFiles(
  files: File[],
  fallbackSport = '',
): Promise<ActivityFileParseResult> {
  const activities: UploadActivity[] = [];
  const warnings: string[] = [];

  for (const file of files) {
    try {
      const { name, text } = await readFileText(file);
      const lowerName = name.toLowerCase();
      let parsed: UploadActivity[] = [];

      if (lowerName.endsWith('.gpx')) {
        parsed = await parseGpx(name, text, fallbackSport);
      } else if (lowerName.endsWith('.geojson') || lowerName.endsWith('.json')) {
        parsed = await parseGeoJson(name, text, fallbackSport);
      } else if (lowerName.endsWith('.fit')) {
        warnings.push(`${file.name}: FIT is not supported yet; export it as GPX first.`);
        continue;
      } else {
        warnings.push(`${file.name}: unsupported file type.`);
        continue;
      }

      if (parsed.length === 0) {
        warnings.push(`${file.name}: no LineString activity was found.`);
      }
      activities.push(...parsed);
    } catch (error) {
      warnings.push(
        `${file.name}: ${error instanceof Error ? error.message : 'could not be parsed'}`,
      );
    }
  }

  return { activities, warnings };
}
