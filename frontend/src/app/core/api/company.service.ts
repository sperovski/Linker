import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CompanyDashboard, CompanyProfile, UpdateCompanyProfileRequest } from '../models';

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/companies`;

  getMe(): Observable<CompanyProfile> {
    return this.http.get<CompanyProfile>(`${this.baseUrl}/me`);
  }

  updateMe(request: UpdateCompanyProfileRequest): Observable<CompanyProfile> {
    return this.http.put<CompanyProfile>(`${this.baseUrl}/me`, request);
  }

  getById(id: number): Observable<CompanyProfile> {
    return this.http.get<CompanyProfile>(`${this.baseUrl}/${id}`);
  }

  getDashboard(): Observable<CompanyDashboard> {
    return this.http.get<CompanyDashboard>(`${this.baseUrl}/dashboard`);
  }
}
