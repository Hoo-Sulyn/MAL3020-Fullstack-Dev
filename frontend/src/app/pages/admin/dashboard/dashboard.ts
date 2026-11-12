import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { Booking, Room, RoomService } from '../../../services/room.service';
import { RealtimeService } from '../../../services/realtime.service';
import { getHotelDateValue } from '../../../services/date.utils';

type DashboardBookingStatus = 'All statuses' | Booking['status'];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private readonly roomService = inject(RoomService);
  private readonly router = inject(Router);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly today = getHotelDateValue();
  readonly currentMonth = new Intl.DateTimeFormat('en-MY', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${this.today}T00:00:00`));
  readonly bookingStatuses: DashboardBookingStatus[] = [
    'All statuses',
    'Confirmed',
    'Checked in',
    'Checked out',
    'Cancelled',
  ];

  statusFilterDropdownOpen = false;
  selectedStatus: DashboardBookingStatus = 'All statuses';
  searchQuery = '';
  rooms: Room[] = [];
  bookings: Booking[] = [];
  isLoading = true;
  pageError = '';

  ngOnInit(): void {
    this.loadDashboardData();
    this.realtime
      .bookingChanges()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadDashboardData());
  }

  private loadDashboardData(): void {
    this.isLoading = true;
    this.pageError = '';
    forkJoin({
      rooms: this.roomService.getAdminRooms(),
      bookings: this.roomService.getAdminBookings(),
    }).subscribe({
      next: ({ rooms, bookings }) => {
        this.rooms = rooms;
        this.bookings = bookings;
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.pageError = this.errorMessage(error);
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  get currentBookings(): Booking[] {
    return this.bookings.filter(
      (booking) =>
        (booking.status === 'Confirmed' || booking.status === 'Checked in') &&
        booking.checkIn <= this.today &&
        booking.checkOut > this.today,
    );
  }

  get bookedRoomCount(): number {
    return new Set(this.currentBookings.map((booking) => booking.roomId)).size;
  }

  get occupancyPercentage(): number {
    return this.rooms.length === 0
      ? 0
      : Math.round((this.bookedRoomCount / this.rooms.length) * 100);
  }

  get availableRoomCount(): number {
    return this.rooms.filter((room) => room.status === 'Available').length;
  }

  get occupiedRoomCount(): number {
    return this.rooms.filter((room) => room.status === 'Occupied').length;
  }

  get maintenanceRoomCount(): number {
    return this.rooms.filter((room) => room.status === 'Maintenance').length;
  }

  get arrivalsToday(): number {
    return this.bookings.filter(
      (booking) => booking.status !== 'Cancelled' && booking.checkIn === this.today,
    ).length;
  }

  get departuresToday(): number {
    return this.bookings.filter(
      (booking) => booking.status !== 'Cancelled' && booking.checkOut === this.today,
    ).length;
  }

  get monthlyRevenue(): number {
    const monthPrefix = this.today.slice(0, 7);
    return this.bookings
      .filter((booking) => booking.checkIn.startsWith(monthPrefix))
      .reduce(
        (total, booking) =>
          total + (booking.status === 'Cancelled' ? -booking.total : booking.total),
        0,
      );
  }

  get recentBookings(): Booking[] {
    return [...this.bookings]
      .sort((first, second) => {
        const createdAtDifference = Date.parse(second.createdAt) - Date.parse(first.createdAt);
        return Number.isNaN(createdAtDifference) || createdAtDifference === 0
          ? second.checkIn.localeCompare(first.checkIn)
          : createdAtDifference;
      })
      .slice(0, 5);
  }

  get filteredBookings(): Booking[] {
    const query = this.searchQuery.trim().toLowerCase();
    return this.recentBookings.filter((booking) => {
      const matchesSearch =
        !query ||
        booking.guestName.toLowerCase().includes(query) ||
        booking.bookingId.toLowerCase().includes(query) ||
        booking.room.toLowerCase().includes(query);
      const matchesStatus =
        this.selectedStatus === 'All statuses' || booking.status === this.selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }

  viewBookingDetails(booking: Booking): void {
    void this.router.navigate(['/bookingManagement'], {
      queryParams: { booking: booking.bookingId },
    });
  }

  updateSearchQuery(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.searchQuery = event.target.value;
    }
  }

  toggleStatusFilterDropdown(): void {
    this.statusFilterDropdownOpen = !this.statusFilterDropdownOpen;
  }

  selectBookingStatus(status: DashboardBookingStatus): void {
    this.selectedStatus = status;
    this.statusFilterDropdownOpen = false;
  }

  formatDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    return new Intl.DateTimeFormat('en-MY', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(year, month - 1, day));
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: 'MYR',
      maximumFractionDigits: 2,
    }).format(amount);
  }

  @HostListener('document:click')
  closeStatusFilterDropdown(): void {
    this.statusFilterDropdownOpen = false;
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Cannot reach the server. Check that the backend is running and accessible.';
      }
      if (typeof error.error?.message === 'string') {
        return error.error.message;
      }
      if (error.status === 401 || error.status === 403) {
        return 'Sign in with an admin account to view dashboard data.';
      }
    }
    return 'Unable to load dashboard data.';
  }
}
