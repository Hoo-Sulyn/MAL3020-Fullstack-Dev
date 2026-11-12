import { ChangeDetectorRef, Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService, AuthUser } from '../../../services/auth.service';
import { RealtimeService } from '../../../services/realtime.service';
import { Room, RoomService } from '../../../services/room.service';
import { getHotelDateValue } from '../../../services/date.utils';

@Component({
  selector: 'app-confirm-booking',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './confirmBooking.html',
  styleUrl: './confirmBooking.css',
})
export class ConfirmBooking implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private readonly roomService = inject(RoomService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  bookingForm: FormGroup;
  occupancyDropdownOpen = false;
  adults = 1;
  children = 0;
  travelingWithPets = false;
  room: Room | null = null;
  isLoading = true;
  isSubmitting = false;
  isEditing = false;
  editingBookingId = '';
  errorMessage = '';

  constructor() {
    this.bookingForm = this.fb.group({
      'check-in-date': ['', Validators.required],
      'check-out-date': ['', Validators.required],
    });
  }

  get occupancySummary(): string {
    const adultLabel = this.adults === 1 ? 'adult' : 'adults';
    const childLabel = this.children === 1 ? 'child' : 'children';
    return `${this.adults} ${adultLabel} · ${this.children} ${childLabel}`;
  }

  get user(): AuthUser | null {
    return this.auth.getCurrentUser();
  }

  getNights(): number {
    const checkIn = this.bookingForm.get('check-in-date')?.value as string;
    const checkOut = this.bookingForm.get('check-out-date')?.value as string;
    if (!checkIn || !checkOut || checkIn >= checkOut) {
      return 0;
    }
    return (Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86_400_000;
  }

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const bookingId = params.get('bookingId');
    this.isEditing = Boolean(bookingId);
    this.editingBookingId = bookingId || '';
    this.bookingForm.patchValue({
      'check-in-date': params.get('checkIn') || '',
      'check-out-date': params.get('checkOut') || '',
    });
    this.adults = Math.max(1, Number(params.get('adults')) || 1);
    this.children = Math.max(0, Number(params.get('children')) || 0);
    this.travelingWithPets = params.get('travelingWithPets') === 'true';

    if (bookingId) {
      this.loadBookingForEdit(bookingId);
      return;
    }

    this.loadRoom(params.get('roomId') || '');
  }

  private loadBookingForEdit(bookingId: string): void {
    this.roomService.getMyBookings().subscribe({
      next: (bookings) => {
        const booking = bookings.find((item) => item.id === bookingId);
        if (!booking || booking.status !== 'Confirmed' || booking.checkIn <= getHotelDateValue()) {
          this.errorMessage = 'This booking can no longer be edited.';
          this.isLoading = false;
          this.changeDetector.markForCheck();
          return;
        }

        this.bookingForm.patchValue({
          'check-in-date': booking.checkIn,
          'check-out-date': booking.checkOut,
        });
        this.adults = booking.adults;
        this.children = booking.children;
        this.travelingWithPets = booking.travelingWithPets;
        this.loadRoom(booking.roomId);
      },
      error: (error: unknown) => {
        this.errorMessage = this.getRequestError(error, 'Unable to load this booking.');
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  private loadRoom(roomId: string): void {
    if (!roomId) {
      this.errorMessage = 'Select a room before confirming your booking.';
      this.isLoading = false;
      return;
    }
    this.roomService.getRoom(roomId).subscribe({
      next: (room) => {
        this.room = room;
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.errorMessage = this.getRequestError(error, 'Unable to load this room.');
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  toggleOccupancyDropdown(): void {
    this.occupancyDropdownOpen = !this.occupancyDropdownOpen;
  }

  increaseCount(type: 'adults' | 'children'): void {
    this[type] += 1;
  }

  decreaseCount(type: 'adults' | 'children'): void {
    const minimum = type === 'children' ? 0 : 1;
    this[type] = Math.max(minimum, this[type] - 1);
  }

  closeOccupancyDropdown(): void {
    this.occupancyDropdownOpen = false;
  }

  @HostListener('document:click')
  closeDropdownOnOutsideClick(): void {
    this.closeOccupancyDropdown();
  }

  onSubmit(): void {
    if (!this.room || this.bookingForm.invalid || this.isSubmitting) {
      this.bookingForm.markAllAsTouched();
      return;
    }
    if (!this.realtime.getToken() || this.user?.role !== 'guest') {
      this.router.navigate(['/'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }

    const checkIn = this.bookingForm.get('check-in-date')?.value as string;
    const checkOut = this.bookingForm.get('check-out-date')?.value as string;
    const today = getHotelDateValue();
    if (checkIn < today || checkIn >= checkOut) {
      this.errorMessage =
        'Choose a check-in date today or later and a check-out date after check-in.';
      return;
    }
    if (this.adults + this.children > this.room.capacity) {
      this.errorMessage = `This room accommodates up to ${this.room.capacity} guest(s).`;
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    const bookingDetails = {
      checkIn,
      checkOut,
      adults: this.adults,
      children: this.children,
      travelingWithPets: this.travelingWithPets,
    };
    const saveBooking = this.isEditing
      ? this.roomService.updateGuestBooking(this.editingBookingId, bookingDetails)
      : this.roomService.createBooking({ roomId: this.room.id, ...bookingDetails });
    saveBooking.subscribe({
      next: (booking) => {
        void this.router.navigate(['/history'], {
          queryParams: this.isEditing
            ? { updated: booking.bookingId }
            : { confirmed: booking.bookingId },
        });
      },
      error: (error: unknown) => {
        this.errorMessage = this.getRequestError(error, 'Unable to confirm this booking.');
        this.isSubmitting = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  private getRequestError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error?.message === 'string') {
        return error.error.message;
      }
      if (error.status === 0) {
        return 'Cannot reach the server. Check that the backend is running.';
      }
    }
    return fallback;
  }
}
