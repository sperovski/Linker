import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminInternship, AdminStats, AdminUser, SkillResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/admin`;

  getStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.baseUrl}/stats`);
  }

  getUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${this.baseUrl}/users`);
  }

  setUserActive(id: number, isActive: boolean): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/users/${id}/active`, { isActive });
  }

  getInternships(): Observable<AdminInternship[]> {
    return this.http.get<AdminInternship[]>(`${this.baseUrl}/internships`);
  }

  closeInternship(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/internships/${id}/close`, {});
  }

  createSkill(name: string): Observable<SkillResponse> {
    return this.http.post<SkillResponse>(`${this.baseUrl}/skills`, { name });
  }
}
