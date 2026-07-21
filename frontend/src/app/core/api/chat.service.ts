import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChatMessageResponse, ChatRoomResponse, PagedResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/chatrooms`;

  getGeneralRoom(): Observable<ChatRoomResponse> {
    return this.http.get<ChatRoomResponse>(`${this.baseUrl}/general`);
  }

  getCompanyRoom(companyId: number): Observable<ChatRoomResponse> {
    return this.http.get<ChatRoomResponse>(`${this.baseUrl}/company/${companyId}`);
  }

  getInternshipRoom(internshipId: number): Observable<ChatRoomResponse> {
    return this.http.get<ChatRoomResponse>(`${this.baseUrl}/internship/${internshipId}`);
  }

  /** Opens (creating on first use) the chat channel for a UKIM faculty. */
  getFacultyRoom(facultyName: string): Observable<ChatRoomResponse> {
    return this.http.get<ChatRoomResponse>(`${this.baseUrl}/faculty`, {
      params: new HttpParams().set('name', facultyName),
    });
  }

  getMessages(roomId: number, page = 1, pageSize = 50): Observable<PagedResponse<ChatMessageResponse>> {
    return this.http.get<PagedResponse<ChatMessageResponse>>(`${this.baseUrl}/${roomId}/messages`, {
      params: new HttpParams().set('page', page).set('pageSize', pageSize),
    });
  }

  reportMessage(messageId: number, reason: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/messages/${messageId}/report`, { reason });
  }

  deleteMessage(messageId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/messages/${messageId}`);
  }
}
