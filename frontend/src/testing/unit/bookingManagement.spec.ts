import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { BookingManagement } from '../../app/pages/admin/bookingManagement/bookingManagement';
import { RealtimeService } from '../../app/services/realtime.service';
import { Booking, RoomService } from '../../app/services/room.service';

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'booking-123',
    bookingId: 'HV-123',
    guestId: 'guest-123',
    guestName: 'Test Guest',
    email: 'guest@example.com',
    phone: '+60123456789',
    roomId: 'room-123',
    room: '101 · Superior King',
    roomNumber: '101',
    roomType: 'Superior King',
    checkIn: '2020-01-01',
    checkOut: '2020-01-03',
    status: 'Confirmed',
    total: 400,
    nightlyRate: 200,
    adults: 1,
    children: 0,
    travelingWithPets: false,
    createdAt: '2020-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('BookingManagement cancellation eligibility', () => {
  it('allows admins to cancel confirmed bookings even after their dates have passed', () => {
    TestBed.configureTestingModule({
      imports: [BookingManagement],
      providers: [
        { provide: RoomService, useValue: { getAdminBookings: () => of([]) } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => null } } },
        },
        { provide: RealtimeService, useValue: { bookingChanges: () => new Subject().asObservable() } },
      ],
    });

    const fixture = TestBed.createComponent(BookingManagement);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.canCancel(makeBooking())).toBe(true);
    expect(component.canCancel(makeBooking({ status: 'Checked in' }))).toBe(false);
    expect(component.canCancel(makeBooking({ status: 'Cancelled' }))).toBe(false);
    fixture.destroy();
  });
});
