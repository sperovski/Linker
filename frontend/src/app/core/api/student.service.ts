import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StudentProfile, UpdateStudentProfileRequest } from '../models';

@Injectable({ providedIn: 'root' })
export class StudentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/students`;

  getMe(): Observable<StudentProfile> {
    return this.http.get<StudentProfile>(`${this.baseUrl}/me`);
  }

  updateMe(request: UpdateStudentProfileRequest): Observable<StudentProfile> {
    return this.http.put<StudentProfile>(`${this.baseUrl}/me`, request);
  }

  getById(id: number): Observable<StudentProfile> {
    return this.http.get<StudentProfile>(`${this.baseUrl}/${id}`);
  }
}
