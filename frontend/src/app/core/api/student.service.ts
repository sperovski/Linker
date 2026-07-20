import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CvImportResponse,
  SaveEducationRequest,
  SaveExperienceRequest,
  SaveProjectRequest,
  StudentProfile,
  UpdateStudentProfileRequest,
} from '../models';

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

  /**
   * Uploads a CV file (PDF/DOC/DOCX, 5MB max), sets it as the profile's CV and
   * imports what can be read from it — matching skills, and a bio when the
   * student doesn't already have one.
   */
  uploadCv(file: File): Observable<CvImportResponse> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<CvImportResponse>(`${this.baseUrl}/me/cv-file`, form);
  }

  /**
   * Fetches an uploaded CV as a blob. CV files are served only through this
   * authenticated endpoint (the auth interceptor attaches the token) — they are
   * no longer public static files, so a plain anchor href would 401.
   */
  downloadCvFile(studentId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${studentId}/cv`, { responseType: 'blob' });
  }

  getById(id: number): Observable<StudentProfile> {
    return this.http.get<StudentProfile>(`${this.baseUrl}/${id}`);
  }

  // ---- Profile sections: every mutation returns the refreshed full profile ----

  addExperience(request: SaveExperienceRequest): Observable<StudentProfile> {
    return this.http.post<StudentProfile>(`${this.baseUrl}/me/experience`, request);
  }

  updateExperience(id: number, request: SaveExperienceRequest): Observable<StudentProfile> {
    return this.http.put<StudentProfile>(`${this.baseUrl}/me/experience/${id}`, request);
  }

  deleteExperience(id: number): Observable<StudentProfile> {
    return this.http.delete<StudentProfile>(`${this.baseUrl}/me/experience/${id}`);
  }

  addEducation(request: SaveEducationRequest): Observable<StudentProfile> {
    return this.http.post<StudentProfile>(`${this.baseUrl}/me/education`, request);
  }

  updateEducation(id: number, request: SaveEducationRequest): Observable<StudentProfile> {
    return this.http.put<StudentProfile>(`${this.baseUrl}/me/education/${id}`, request);
  }

  deleteEducation(id: number): Observable<StudentProfile> {
    return this.http.delete<StudentProfile>(`${this.baseUrl}/me/education/${id}`);
  }

  addProject(request: SaveProjectRequest): Observable<StudentProfile> {
    return this.http.post<StudentProfile>(`${this.baseUrl}/me/projects`, request);
  }

  updateProject(id: number, request: SaveProjectRequest): Observable<StudentProfile> {
    return this.http.put<StudentProfile>(`${this.baseUrl}/me/projects/${id}`, request);
  }

  deleteProject(id: number): Observable<StudentProfile> {
    return this.http.delete<StudentProfile>(`${this.baseUrl}/me/projects/${id}`);
  }
}
