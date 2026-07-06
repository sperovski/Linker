import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CvFileReviewResponse, CvReviewRequest, CvReviewResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class CvService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/cv`;

  review(request: CvReviewRequest): Observable<CvReviewResponse> {
    return this.http.post<CvReviewResponse>(`${this.baseUrl}/review`, request);
  }

  reviewFile(file: File, internshipId: number | null): Observable<CvFileReviewResponse> {
    const form = new FormData();
    form.append('file', file);
    if (internshipId !== null) {
      form.append('internshipId', String(internshipId));
    }
    return this.http.post<CvFileReviewResponse>(`${this.baseUrl}/review/file`, form);
  }
}
