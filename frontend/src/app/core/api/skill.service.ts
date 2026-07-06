import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SkillResponse, StudentProfile } from '../models';

@Injectable({ providedIn: 'root' })
export class SkillService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/skills`;

  getAll(): Observable<SkillResponse[]> {
    return this.http.get<SkillResponse[]>(this.baseUrl);
  }

  assign(skillId: number): Observable<StudentProfile> {
    return this.http.post<StudentProfile>(`${this.baseUrl}/assign`, { skillId });
  }

  remove(skillId: number): Observable<StudentProfile> {
    return this.http.delete<StudentProfile>(`${this.baseUrl}/assign/${skillId}`);
  }
}
