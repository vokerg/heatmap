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

  protected readonly activityCount = signal(0);
  protected readonly distanceKilometers = signal(0);
  protected readonly zoom = signal(11.2);
  protected readonly ready = signal(false);
  protected readonly visualMode = new URLSearchParams(window.location.search).get('visual') === '1';

  ngAfterViewInit(): void {
    const parameters = new URLSearchParams(window.location.search);
    const requestedCenter = parameters.get('center')?.split(',').map(Number);
    const requestedZoom = Number(parameters.get('zoom'));
    const center: [number, number] =
      requestedCenter?.length === 2 && requestedCenter.every(Number.isFinite)
        ? [requestedCenter[0]!, requestedCenter[1]!]
        : [12.407, 55.775];
    const zoom = Number.isFinite(requestedZoom) ? requestedZoom : 11.2;

    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: createMapStyle(this.visualMode),
      center,
      zoom,
      minZoom: 6,
      maxZoom: 18,
      attributionControl: this.visualMode ? false : { compact: true },
      fadeDuration: 0,
    });

    this.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    this.map.on('zoom', () => this.zoom.set(this.map?.getZoom() ?? zoom));
    this.map.once('idle', () => {
      this.ready.set(true);
      document.documentElement.dataset['heatmapReady'] = 'true';
    });

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

  ngOnDestroy(): void {
    this.map?.remove();
  }

  protected resetView(): void {
    this.map?.easeTo({ center: [12.407, 55.775], zoom: 11.2, duration: 500 });
  }
}
