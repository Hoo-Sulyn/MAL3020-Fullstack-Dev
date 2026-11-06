import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { RealtimeService } from './realtime.service';

export type AuthRole = 'guest' | 'admin';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: AuthRole;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

interface RegisterResponse {
  message: string;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = 'http://localhost:3000/api/auth';
  private readonly profileUrl = 'http://localhost:3000/api/profile';
  private readonly sessionKey = 'haven_session';

  constructor(
    private readonly http: HttpClient,
    private readonly realtime: RealtimeService
  ) {}

  register(payload: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
  }): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.apiUrl}/register`, payload);
  }

  login(email: string, password: string, role: AuthRole): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/login`, { email, password, role })
      .pipe(tap((response) => localStorage.setItem(this.sessionKey, JSON.stringify(response))));
  }

  getProfile(): Observable<AuthUser> {
    return this.http.get<AuthUser>(this.profileUrl, {
      headers: this.authHeaders(),
    });
  }

  updateProfile(profile: Pick<AuthUser, 'firstName' | 'lastName' | 'email' | 'phone'>): Observable<AuthUser> {
    return this.http.put<AuthUser>(this.profileUrl, profile, {
      headers: this.authHeaders(),
    });
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.put<void>(
      `${this.profileUrl}/password`,
      { currentPassword, newPassword },
      { headers: this.authHeaders() }
    );
  }

  deleteAccount(): Observable<void> {
    return this.http.delete<void>(`${this.profileUrl}/account`, {
      headers: this.authHeaders(),
    });
  }

  updateCachedUser(user: AuthUser): void {
    const storedSession = localStorage.getItem(this.sessionKey);
    if (!storedSession) {
      return;
    }

    try {
      const session = JSON.parse(storedSession) as AuthResponse;
      localStorage.setItem(this.sessionKey, JSON.stringify({ ...session, user }));
    } catch (error) {
      console.error('Unable to update saved user session:', error);
    }
  }

  logout(): void {
    localStorage.removeItem(this.sessionKey);
    this.realtime.disconnect();
  }

  getCurrentUser(): AuthUser | null {
    const session = localStorage.getItem(this.sessionKey);
    if (!session) {
      return null;
    }

    try {
      const parsed = JSON.parse(session) as AuthResponse;
      return parsed.user ?? null;
    } catch (error) {
      console.error('Unable to read saved user session:', error);
      return null;
    }
  }

  private authHeaders(): HttpHeaders {
    const token = this.realtime.getToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }
}
