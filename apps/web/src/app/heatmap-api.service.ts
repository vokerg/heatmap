import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

export interface HeatmapStats {
  activityCount: number;
  distanceMeters: number;
}

@Injectable({ providedIn: 'root' })
export class HeatmapApiService {
  private readonly http = inject(HttpClient);

  getStats(): Observable<HeatmapStats> {
    return this.http.get<HeatmapStats>('/api/stats');
  }
}
