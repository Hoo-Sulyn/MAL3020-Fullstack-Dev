import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly tokenKey = 'haven_token';

  connect(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  disconnect(): void {
    localStorage.removeItem(this.tokenKey);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isConnected(): boolean {
    return Boolean(this.getToken());
  }
}
