import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { UploadActivity } from './activity-file-parser';

export interface HeatmapStats {
  activityCount: number;
  distanceMeters: number;
}

export interface ActivityBatchResult {
  imported: number;
  ids: string[];
  bounds: [number, number, number, number] | null;
}

@Injectable({ providedIn: 'root' })
export class HeatmapApiService {
  private readonly http = inject(HttpClient);

  getStats(): Observable<HeatmapStats> {
    return this.http.get<HeatmapStats>('/api/stats');
  }

  importActivities(activities: UploadActivity[]): Observable<ActivityBatchResult> {
    return this.http.post<ActivityBatchResult>('/api/activities/batch', { activities });
  }
}
