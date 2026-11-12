import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { RealtimeService } from './realtime.service';

export type RoomStatus = 'Available' | 'Occupied' | 'Maintenance';
export type RoomStatusOverride = RoomStatus | 'Automatic';

export interface Room {
  id: string;
  number: string;
  type: string;
  floor: number;
  description: string;
  amenities: string;
  capacity: number;
  nightlyRate: number;
  status: RoomStatus;
  statusOverride: RoomStatusOverride;
}

export interface RoomPayload {
  number: string;
  type: string;
  floor: number;
  description: string;
  amenities: string;
  capacity: number;
  nightlyRate: number;
  status: RoomStatusOverride;
}

export interface Booking {
  id: string;
  bookingId: string;
  guestId: string;
  guestName: string;
  email: string;
  phone: string;
  roomId: string;
  room: string;
  roomNumber: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  status: 'Confirmed' | 'Checked in' | 'Checked out' | 'Cancelled';
  total: number;
  nightlyRate: number;
  adults: number;
  children: number;
  travelingWithPets: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class RoomService {
  private readonly http = inject(HttpClient);
  private readonly realtime = inject(RealtimeService);

  private readonly apiUrl = 'http://localhost:3000/api';

  getRooms(checkIn?: string, checkOut?: string, adults = 1): Observable<Room[]> {
    let params = new HttpParams();
    if (checkIn && checkOut) {
      params = params.set('checkIn', checkIn).set('checkOut', checkOut).set('adults', adults);
    }
    return this.http.get<Room[]>(`${this.apiUrl}/rooms`, { params });
  }

  getRoom(id: string): Observable<Room> {
    return this.http.get<Room>(`${this.apiUrl}/rooms/${encodeURIComponent(id)}`);
  }

  getAdminRooms(): Observable<Room[]> {
    return this.http.get<Room[]>(`${this.apiUrl}/rooms/admin`, { headers: this.authHeaders() });
  }

  createRoom(room: RoomPayload): Observable<Room> {
    return this.http.post<Room>(`${this.apiUrl}/rooms`, room, { headers: this.authHeaders() });
  }

  updateRoom(id: string, room: RoomPayload): Observable<Room> {
    return this.http.put<Room>(`${this.apiUrl}/rooms/${encodeURIComponent(id)}`, room, {
      headers: this.authHeaders(),
    });
  }

  updateRoomStatus(id: string, status: RoomStatusOverride): Observable<Room> {
    return this.http.patch<Room>(
      `${this.apiUrl}/rooms/${encodeURIComponent(id)}/status`,
      { status },
      { headers: this.authHeaders() },
    );
  }

  deleteRoom(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/rooms/${encodeURIComponent(id)}`, {
      headers: this.authHeaders(),
    });
  }

  createBooking(booking: {
    roomId: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    travelingWithPets: boolean;
  }): Observable<Booking> {
    return this.http.post<Booking>(`${this.apiUrl}/bookings`, booking, {
      headers: this.authHeaders(),
    });
  }

  updateGuestBooking(
    id: string,
    booking: {
      checkIn: string;
      checkOut: string;
      adults: number;
      children: number;
      travelingWithPets: boolean;
    },
  ): Observable<Booking> {
    return this.http.put<Booking>(`${this.apiUrl}/bookings/${encodeURIComponent(id)}`, booking, {
      headers: this.authHeaders(),
    });
  }

  getMyBookings(): Observable<Booking[]> {
    return this.http.get<Booking[]>(`${this.apiUrl}/bookings/mine`, {
      headers: this.authHeaders(),
    });
  }

  getAdminBookings(): Observable<Booking[]> {
    return this.http.get<Booking[]>(`${this.apiUrl}/bookings/admin`, {
      headers: this.authHeaders(),
    });
  }

  cancelBooking(id: string): Observable<Booking> {
    return this.http.patch<Booking>(
      `${this.apiUrl}/bookings/${encodeURIComponent(id)}/cancel`,
      {},
      { headers: this.authHeaders() },
    );
  }

  updateBookingStatus(
    id: string,
    status: 'Checked in' | 'Checked out' | 'Cancelled',
  ): Observable<Booking> {
    return this.http.patch<Booking>(
      `${this.apiUrl}/bookings/${encodeURIComponent(id)}/status`,
      { status },
      { headers: this.authHeaders() },
    );
  }

  private authHeaders(): HttpHeaders {
    const token = this.realtime.getToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }
}
