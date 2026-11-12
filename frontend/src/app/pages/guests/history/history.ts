import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../services/auth.service';
import { Booking, RoomService } from '../../../services/room.service';
import { RealtimeService } from '../../../services/realtime.service';
import { getHotelDateValue } from '../../../services/date.utils';
import { getRoomImage } from '../../../services/room-image.utils';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history.html',
  styleUrl: './history.css',
})
export class History implements OnInit {
  private readonly roomService = inject(RoomService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly todayLabel = new Intl.DateTimeFormat('en-MY', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${getHotelDateValue()}T00:00:00`));
  bookings: Booking[] = [];
  selectedBooking: Booking | null = null;
  isLoading = true;
  isCancelling = false;
  errorMessage = '';
  successMessage = '';

  get currentAndUpcomingBookings(): Booking[] {
    const today = getHotelDateValue();
    return this.bookings.filter(
      (booking) =>
        booking.status !== 'Cancelled' &&
        booking.status !== 'Checked out' &&
        booking.checkOut > today,
    );
  }

  get pastBookings(): Booking[] {
    const today = getHotelDateValue();
    return this.bookings.filter(
      (booking) =>
        booking.status !== 'Cancelled' &&
        (booking.status === 'Checked out' || booking.checkOut <= today),
    );
  }

  get cancelledBookings(): Booking[] {
    return this.bookings.filter((booking) => booking.status === 'Cancelled');
  }

  get guestName(): string {
    const user = this.auth.getCurrentUser();
    return user ? `${user.firstName} ${user.lastName}` : 'Guest';
  }

  ngOnInit(): void {
    const confirmedBooking = this.route.snapshot.queryParamMap.get('confirmed');
    const updatedBooking = this.route.snapshot.queryParamMap.get('updated');
    if (confirmedBooking) {
      this.successMessage = `Booking ${confirmedBooking} is confirmed.`;
    } else if (updatedBooking) {
      this.successMessage = `Booking ${updatedBooking} has been updated.`;
    }
    this.loadBookings();
    this.realtime
      .bookingChanges()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (this.bookings.some((booking) => booking.id === event.id)) {
          this.loadBookings(true);
        }
      });
  }

  private loadBookings(preserveSelection = false): void {
    const selectedBookingId = preserveSelection ? this.selectedBooking?.id : null;
    this.isLoading = true;
    this.errorMessage = '';
    this.roomService.getMyBookings().subscribe({
      next: (bookings) => {
        this.bookings = bookings;
        this.selectedBooking = selectedBookingId
          ? (bookings.find((booking) => booking.id === selectedBookingId) ?? null)
          : null;
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.errorMessage =
          error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
            ? error.error.message
            : error instanceof HttpErrorResponse && error.status === 0
              ? 'Cannot reach the server. Check that the backend is running.'
              : 'Unable to load your bookings.';
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  canCancel(booking: Booking): boolean {
    return booking.status === 'Confirmed' && booking.checkIn > getHotelDateValue();
  }

  canEdit(booking: Booking): boolean {
    return booking.status === 'Confirmed' && booking.checkIn > getHotelDateValue();
  }

  openCancellation(booking: Booking): void {
    this.selectedBooking = booking;
    this.errorMessage = '';
  }

  keepBooking(): void {
    this.selectedBooking = null;
  }

  showBookingDetails(booking: Booking): void {
    void this.router.navigate(['/roomDetails'], {
      queryParams: {
        id: booking.roomId,
        image: getRoomImage(booking.roomType),
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        adults: booking.adults,
        children: booking.children,
        travelingWithPets: booking.travelingWithPets,
        fromHistory: true,
        bookingId: booking.bookingId,
        bookingStatus: booking.status,
        bookingTotal: booking.total,
        nightlyRate: booking.nightlyRate,
      },
    });
  }

  editBooking(booking: Booking): void {
    void this.router.navigate(['/confirmBooking'], {
      queryParams: { bookingId: booking.id },
    });
  }

  confirmCancellation(): void {
    if (!this.selectedBooking || this.isCancelling) {
      return;
    }
    this.isCancelling = true;
    this.errorMessage = '';
    this.roomService.cancelBooking(this.selectedBooking.id).subscribe({
      next: (updatedBooking) => {
        this.bookings = this.bookings.map((booking) =>
          booking.id === updatedBooking.id ? updatedBooking : booking,
        );
        this.selectedBooking = null;
        this.isCancelling = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.errorMessage =
          error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
            ? error.error.message
            : 'Unable to cancel this booking.';
        this.isCancelling = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  formatDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    return new Intl.DateTimeFormat('en-MY', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(year, month - 1, day));
  }

  getNights(booking: Booking): number {
    return (
      (Date.parse(`${booking.checkOut}T00:00:00Z`) - Date.parse(`${booking.checkIn}T00:00:00Z`)) /
      86_400_000
    );
  }
}
