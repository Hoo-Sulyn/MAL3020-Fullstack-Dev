import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import type { Socket } from 'socket.io-client';

export interface BookingChangeEvent {
  action: 'created' | 'updated';
  id: string;
}

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly tokenKey = 'haven_token';
  private readonly bookingChangesSubject = new Subject<BookingChangeEvent>();
  private socket: Socket | null = null;
  private isLoadingSocketClient = false;

  connect(token: string): void {
    localStorage.setItem(this.tokenKey, token);
    this.socket?.disconnect();
    this.socket = null;
    this.openSocket();
  }

  private openSocket(): void {
    if (!this.getToken() || this.socket || this.isLoadingSocketClient) {
      return;
    }

    this.isLoadingSocketClient = true;
    void import('socket.io-client').then(({ io }) => {
      this.isLoadingSocketClient = false;
      if (!this.getToken() || this.socket) {
        return;
      }

      this.socket = io('http://localhost:3000', {
        transports: ['websocket'],
        auth: (callback) => callback({ token: this.getToken() }),
      });
      this.socket.on('booking:changed', (event: BookingChangeEvent) => {
        this.bookingChangesSubject.next(event);
      });
      this.socket.on('connect_error', (error) => {
        console.error('Realtime connection failed:', error.message);
      });
    }).catch((error: unknown) => {
      this.isLoadingSocketClient = false;
      console.error('Unable to load the realtime client:', error);
    });
  }

  disconnect(): void {
    localStorage.removeItem(this.tokenKey);
    this.socket?.disconnect();
    this.socket = null;
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isConnected(): boolean {
    return Boolean(this.getToken());
  }

  bookingChanges(): Observable<BookingChangeEvent> {
    this.openSocket();
    return this.bookingChangesSubject.asObservable();
  }
}
