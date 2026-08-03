import { DecimalPipe } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl';
import { firstValueFrom } from 'rxjs';
import { parseActivityFiles } from './activity-file-parser';
import { HeatmapApiService } from './heatmap-api.service';
import { createMapStyle } from './map-style';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true })
  private mapContainer!: ElementRef<HTMLDivElement>;

  private readonly api = inject(HeatmapApiService);
  private map?: MapLibreMap;
  private storageMode: 'file' | 'postgres' = 'postgres';
  private styleRevision = 0;

  protected readonly activityCount = signal(0);
  protected readonly distanceKilometers = signal(0);
  protected readonly zoom = signal(11.2);
  protected readonly ready = signal(false);
  protected readonly importing = signal(false);
  protected readonly importStatus = signal('');
  protected readonly importFailed = signal(false);
  protected readonly visualMode =
    new URLSearchParams(window.location.search).get('visual') === '1';

  async ngAfterViewInit(): Promise<void> {
    const parameters = new URLSearchParams(window.location.search);
    const requestedCenter = parameters.get('center')?.split(',').map(Number);
    const requestedZoom = Number(parameters.get('zoom'));
    const center: [number, number] =
      requestedCenter?.length === 2 && requestedCenter.every(Number.isFinite)
        ? [requestedCenter[0]!, requestedCenter[1]!]
        : [12.407, 55.775];
    const zoom = Number.isFinite(requestedZoom) ? requestedZoom : 11.2;
    this.zoom.set(zoom);

    this.storageMode = await fetch('/api/config')
      .then(async (response) => {
        if (!response.ok) return 'postgres' as const;
        const config = (await response.json()) as { storageMode?: string };
        return config.storageMode === 'file' ? 'file' : 'postgres';
      })
      .catch(() => 'postgres' as const);

    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: createMapStyle(
        this.visualMode,
        this.storageMode === 'file',
        this.styleRevision,
      ),
      center,
      zoom,
      minZoom: 6,
      maxZoom: 18,
      attributionControl: this.visualMode ? false : { compact: true },
      fadeDuration: 0,
    });

    this.map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'bottom-right',
    );
    this.map.on('zoom', () => this.zoom.set(this.map?.getZoom() ?? zoom));
    this.map.once('idle', () => {
      this.ready.set(true);
      document.documentElement.dataset['heatmapReady'] = 'true';
    });

    this.refreshStats();
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  protected resetView(): void {
    this.map?.easeTo({ center: [12.407, 55.775], zoom: 11.2, duration: 500 });
  }

  protected async importFiles(event: Event, fallbackSport: string): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length === 0) return;

    this.importing.set(true);
    this.importFailed.set(false);
    this.importStatus.set(`Reading ${files.length} file${files.length === 1 ? '' : 's'}…`);

    try {
      const parsed = await parseActivityFiles(files, fallbackSport);
      if (parsed.activities.length === 0) {
        this.importFailed.set(true);
        this.importStatus.set(parsed.warnings.join(' ') || 'No activities were found.');
        return;
      }

      let imported = 0;
      let bounds: [number, number, number, number] | null = null;
      const batchSize = 100;
      for (let index = 0; index < parsed.activities.length; index += batchSize) {
        const batch = parsed.activities.slice(index, index + batchSize);
        this.importStatus.set(
          `Importing ${Math.min(index + batch.length, parsed.activities.length)} of ${parsed.activities.length}…`,
        );
        const result = await firstValueFrom(this.api.importActivities(batch));
        imported += result.imported;
        bounds = this.mergeBounds(bounds, result.bounds);
      }

      this.styleRevision += 1;
      this.map?.setStyle(
        createMapStyle(
          this.visualMode,
          this.storageMode === 'file',
          this.styleRevision,
        ),
      );
      if (bounds) {
        this.map?.fitBounds(
          [
            [bounds[0], bounds[1]],
            [bounds[2], bounds[3]],
          ],
          { padding: 70, maxZoom: 14, duration: 600 },
        );
      }
      this.refreshStats();

      const warningText = parsed.warnings.length
        ? ` ${parsed.warnings.slice(0, 2).join(' ')}`
        : '';
      this.importStatus.set(
        `Imported ${imported} activit${imported === 1 ? 'y' : 'ies'} from ${files.length} file${files.length === 1 ? '' : 's'}.${warningText}`,
      );
    } catch (error) {
      this.importFailed.set(true);
      this.importStatus.set(
        error instanceof Error ? error.message : 'The import failed.',
      );
    } finally {
      this.importing.set(false);
      input.value = '';
    }
  }

  private refreshStats(): void {
    this.api.getStats().subscribe({
      next: (stats) => {
        this.activityCount.set(stats.activityCount);
        this.distanceKilometers.set(stats.distanceMeters / 1000);
      },
      error: () => {
        this.activityCount.set(0);
        this.distanceKilometers.set(0);
      },
    });
  }

  private mergeBounds(
    current: [number, number, number, number] | null,
    incoming: [number, number, number, number] | null,
  ): [number, number, number, number] | null {
    if (!incoming) return current;
    if (!current) return incoming;
    return [
      Math.min(current[0], incoming[0]),
      Math.min(current[1], incoming[1]),
      Math.max(current[2], incoming[2]),
      Math.max(current[3], incoming[3]),
    ];
  }
}
