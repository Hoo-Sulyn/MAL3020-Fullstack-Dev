import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';

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
  private readonly sessionKey = 'haven_session';

  constructor(private http: HttpClient) {}

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

  logout(): void {
    localStorage.removeItem(this.sessionKey);
    localStorage.removeItem('haven_token');
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
}
