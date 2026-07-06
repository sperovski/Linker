import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApplicationResponse,
  CreateInternshipRequest,
  InternshipDetail,
  InternshipListItem,
  InternshipSearchFilters,
} from '../models';

@Injectable({ providedIn: 'root' })
export class InternshipService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/internships`;

  search(filters: InternshipSearchFilters): Observable<InternshipListItem[]> {
    let params = new HttpParams();
    if (filters.location) params = params.set('location', filters.location);
    if (filters.searchText) params = params.set('searchText', filters.searchText);
    if (filters.type) params = params.set('type', filters.type);
    return this.http.get<InternshipListItem[]>(this.baseUrl, { params });
  }

  getMine(): Observable<InternshipListItem[]> {
    return this.http.get<InternshipListItem[]>(`${this.baseUrl}/mine`);
  }

  getSaved(): Observable<InternshipListItem[]> {
    return this.http.get<InternshipListItem[]>(`${this.baseUrl}/saved`);
  }

  getRecommended(take = 6): Observable<InternshipListItem[]> {
    return this.http.get<InternshipListItem[]>(`${this.baseUrl}/recommended`, {
      params: new HttpParams().set('take', take),
    });
  }

  getPopular(take = 6): Observable<InternshipListItem[]> {
    return this.http.get<InternshipListItem[]>(`${this.baseUrl}/popular`, {
      params: new HttpParams().set('take', take),
    });
  }

  save(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/save`, {});
  }

  unsave(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}/save`);
  }

  getDetail(id: number): Observable<InternshipDetail> {
    return this.http.get<InternshipDetail>(`${this.baseUrl}/${id}`);
  }

  create(request: CreateInternshipRequest): Observable<InternshipDetail> {
    return this.http.post<InternshipDetail>(this.baseUrl, request);
  }

  update(id: number, request: CreateInternshipRequest): Observable<InternshipDetail> {
    return this.http.put<InternshipDetail>(`${this.baseUrl}/${id}`, request);
  }

  close(id: number): Observable<InternshipDetail> {
    return this.http.post<InternshipDetail>(`${this.baseUrl}/${id}/close`, {});
  }

  getApplications(id: number): Observable<ApplicationResponse[]> {
    return this.http.get<ApplicationResponse[]>(`${this.baseUrl}/${id}/applications`);
  }
}
