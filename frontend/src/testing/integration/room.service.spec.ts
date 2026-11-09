import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeService } from '../../app/services/realtime.service';
import { Room, RoomService } from '../../app/services/room.service';

describe('RoomService HTTP integration', () => {
  let service: RoomService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: RealtimeService,
          useValue: { getToken: vi.fn().mockReturnValue('test-token') },
        },
      ],
    });

    service = TestBed.inject(RoomService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('sends room search parameters and returns the HTTP response', () => {
    const rooms: Room[] = [{
      id: 'room-101',
      number: '101',
      type: 'Superior King',
      floor: 1,
      description: 'Test room',
      amenities: 'Wi-Fi',
      capacity: 2,
      nightlyRate: 200,
      status: 'Available',
      statusOverride: 'Automatic',
    }];
    let response: Room[] | undefined;

    service.getRooms('2027-01-10', '2027-01-12', 2).subscribe((value) => {
      response = value;
    });

    const request = httpTesting.expectOne((req) =>
      req.url === 'http://localhost:3000/api/rooms'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('checkIn')).toBe('2027-01-10');
    expect(request.request.params.get('checkOut')).toBe('2027-01-12');
    expect(request.request.params.get('adults')).toBe('2');
    request.flush(rooms);

    expect(response).toEqual(rooms);
  });

  it('sends the stored bearer token when requesting guest bookings', () => {
    let response: unknown;

    service.getMyBookings().subscribe((value) => {
      response = value;
    });

    const request = httpTesting.expectOne('http://localhost:3000/api/bookings/mine');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush([]);

    expect(response).toEqual([]);
  });
});
