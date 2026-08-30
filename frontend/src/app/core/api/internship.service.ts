import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Applicant,
  CreateInternshipRequest,
  InternshipDetail,
  InternshipListItem,
  InternshipSearchFilters,
  InternshipSearchResponse,
  PagedResponse,
} from '../models';

@Injectable({ providedIn: 'root' })
export class InternshipService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/internships`;

  search(filters: InternshipSearchFilters): Observable<InternshipSearchResponse> {
    let params = new HttpParams();
    if (filters.location) params = params.set('location', filters.location);
    if (filters.searchText) params = params.set('searchText', filters.searchText);
    if (filters.type) params = params.set('type', filters.type);
    if (filters.company) params = params.set('company', filters.company);
    if (filters.page) params = params.set('page', filters.page);
    if (filters.pageSize) params = params.set('pageSize', filters.pageSize);
    return this.http.get<InternshipSearchResponse>(this.baseUrl, { params });
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

  reopen(id: number): Observable<InternshipDetail> {
    return this.http.post<InternshipDetail>(`${this.baseUrl}/${id}/reopen`, {});
  }

  getApplications(id: number, page = 1, pageSize = 20): Observable<PagedResponse<Applicant>> {
    return this.http.get<PagedResponse<Applicant>>(`${this.baseUrl}/${id}/applications`, {
      params: new HttpParams().set('page', page).set('pageSize', pageSize),
    });
  }
}
