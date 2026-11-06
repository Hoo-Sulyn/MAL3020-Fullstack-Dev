import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../app/services/auth.service';
import { BookingChangeEvent, RealtimeService } from '../../app/services/realtime.service';
import { Booking, RoomService } from '../../app/services/room.service';
import { History } from '../../app/pages/guests/history/history';
import { getHotelDateValue } from '../../app/services/date.utils';

describe('History realtime updates', () => {
  it('reloads a guest booking when that booking changes', () => {
    const bookingChanges = new Subject<BookingChangeEvent>();
    const checkInDate = new Date(`${getHotelDateValue()}T00:00:00.000Z`);
    checkInDate.setUTCDate(checkInDate.getUTCDate() + 30);
    const checkOutDate = new Date(checkInDate);
    checkOutDate.setUTCDate(checkOutDate.getUTCDate() + 2);
    const booking: Booking = {
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
      checkIn: checkInDate.toISOString().slice(0, 10),
      checkOut: checkOutDate.toISOString().slice(0, 10),
      status: 'Confirmed',
      total: 400,
      nightlyRate: 200,
      adults: 1,
      children: 0,
      travelingWithPets: false,
      createdAt: new Date().toISOString(),
    };
    const updatedBooking: Booking = { ...booking, status: 'Checked in' };
    const getMyBookings = vi.fn()
      .mockReturnValueOnce(of([booking]))
      .mockReturnValue(of([updatedBooking]));
    const navigate = vi.fn();

    TestBed.configureTestingModule({
      imports: [History],
      providers: [
        { provide: RoomService, useValue: { getMyBookings } },
        { provide: AuthService, useValue: { getCurrentUser: () => null } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => null } } },
        },
        { provide: Router, useValue: { navigate } },
        {
          provide: RealtimeService,
          useValue: { bookingChanges: () => bookingChanges.asObservable() },
        },
      ],
    });

    const fixture = TestBed.createComponent(History);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    bookingChanges.next({ action: 'updated', id: 'another-booking' });
    expect(getMyBookings).toHaveBeenCalledOnce();

    bookingChanges.next({ action: 'updated', id: booking.id });

    expect(getMyBookings).toHaveBeenCalledTimes(2);
    expect(component.bookings[0].status).toBe('Checked in');

    expect(component.canEdit(booking)).toBe(true);
    expect(component.canEdit(updatedBooking)).toBe(false);
    expect(component.canEdit({ ...booking, checkIn: getHotelDateValue() })).toBe(false);
    component.editBooking(booking);
    expect(navigate).toHaveBeenCalledWith(
      ['/confirmBooking'],
      { queryParams: { bookingId: booking.id } }
    );
  });
});
