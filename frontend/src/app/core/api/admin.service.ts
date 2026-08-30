import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminCompany,
  AdminInternship,
  AdminStats,
  AdminUser,
  PagedResponse,
  SkillResponse,
} from '../models';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/admin`;

  getStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.baseUrl}/stats`);
  }

  getUsers(page = 1, pageSize = 20): Observable<PagedResponse<AdminUser>> {
    return this.http.get<PagedResponse<AdminUser>>(`${this.baseUrl}/users`, {
      params: { page, pageSize },
    });
  }

  setUserActive(id: number, isActive: boolean): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/users/${id}/active`, { isActive });
  }

  getInternships(page = 1, pageSize = 20): Observable<PagedResponse<AdminInternship>> {
    return this.http.get<PagedResponse<AdminInternship>>(`${this.baseUrl}/internships`, {
      params: { page, pageSize },
    });
  }

  closeInternship(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/internships/${id}/close`, {});
  }

  getCompanies(page = 1, pageSize = 20): Observable<PagedResponse<AdminCompany>> {
    return this.http.get<PagedResponse<AdminCompany>>(`${this.baseUrl}/companies`, {
      params: { page, pageSize },
    });
  }

  setCompanyVerified(id: number, isVerified: boolean): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/companies/${id}/verified`, { isVerified });
  }

  createSkill(name: string): Observable<SkillResponse> {
    return this.http.post<SkillResponse>(`${this.baseUrl}/skills`, { name });
  }
}
