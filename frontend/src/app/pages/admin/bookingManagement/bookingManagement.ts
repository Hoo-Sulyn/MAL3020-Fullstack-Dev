import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Booking } from '../../../services/room.service';
import { RoomService } from '../../../services/room.service';
import { getHotelDateValue } from '../../../services/date.utils';

type BookingStatus = Booking['status'];
type BookingTab = 'all' | 'arrivals' | 'departures';
type DateFilter = 'All dates' | 'Today' | 'Upcoming' | 'Past';

@Component({
    selector: 'app-booking-management',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './bookingManagement.html',
    styleUrl: './bookingManagement.css'
})
export class BookingManagement implements OnInit {
    readonly today = getHotelDateValue();
    readonly bookingStatuses: Array<'All statuses' | BookingStatus> = [
        'All statuses',
        'Confirmed',
        'Checked in',
        'Checked out',
        'Cancelled'
    ];
    readonly dateFilters: DateFilter[] = ['All dates', 'Today', 'Upcoming', 'Past'];
    readonly pageSize = 6;

    statusFilterDropdownOpen = false;
    dateFilterDropdownOpen = false;
    selectedStatus: 'All statuses' | BookingStatus = 'All statuses';
    selectedDate: DateFilter = 'All dates';
    selectedTab: BookingTab = 'all';
    selectedBookingId = '';
    searchQuery = '';
    currentPage = 1;
    cancelConfirmationOpen = false;
    bookings: Booking[] = [];
    isLoading = true;
    pageError = '';
    isUpdating = false;

    constructor(
        private readonly roomService: RoomService,
        private readonly changeDetector: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
        this.loadBookings();
    }

    get filteredBookings(): Booking[] {
        const query = this.searchQuery.trim().toLowerCase();
        return this.bookings.filter((booking) => {
            const matchesSearch = !query
                || booking.guestName.toLowerCase().includes(query)
                || booking.bookingId.toLowerCase().includes(query);
            const matchesStatus = this.selectedStatus === 'All statuses'
                || booking.status === this.selectedStatus;
            const matchesTab = this.selectedTab === 'all'
                || (this.selectedTab === 'arrivals'
                    && booking.checkIn === this.today
                    && booking.status !== 'Cancelled')
                || (this.selectedTab === 'departures'
                    && booking.checkOut === this.today
                    && booking.status !== 'Cancelled');
            const matchesDate = this.selectedDate === 'All dates'
                || (this.selectedDate === 'Today'
                    && booking.checkIn <= this.today
                    && booking.checkOut > this.today)
                || (this.selectedDate === 'Upcoming' && booking.checkIn > this.today)
                || (this.selectedDate === 'Past' && booking.checkOut <= this.today);
            return matchesSearch && matchesStatus && matchesTab && matchesDate;
        });
    }

    get selectedBooking(): Booking | null {
        return this.filteredBookings.find((booking) => booking.bookingId === this.selectedBookingId)
            ?? this.filteredBookings[0]
            ?? null;
    }

    get pageCount(): number {
        return Math.max(1, Math.ceil(this.filteredBookings.length / this.pageSize));
    }

    get visibleBookings(): Booking[] {
        const start = (this.currentPage - 1) * this.pageSize;
        return this.filteredBookings.slice(start, start + this.pageSize);
    }

    get firstVisibleBooking(): number {
        return this.filteredBookings.length === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
    }

    get lastVisibleBooking(): number {
        return Math.min(this.currentPage * this.pageSize, this.filteredBookings.length);
    }

    get arrivalsToday(): number {
        return this.bookings.filter((booking) =>
            booking.checkIn === this.today && booking.status !== 'Cancelled'
        ).length;
    }

    get departuresToday(): number {
        return this.bookings.filter((booking) =>
            booking.checkOut === this.today && booking.status !== 'Cancelled'
        ).length;
    }

    updateSearchQuery(event: Event): void {
        if (event.target instanceof HTMLInputElement) {
            this.searchQuery = event.target.value;
            this.resetPage();
        }
    }

    toggleStatusFilterDropdown(): void {
        this.statusFilterDropdownOpen = !this.statusFilterDropdownOpen;
        this.dateFilterDropdownOpen = false;
    }

    toggleDateFilterDropdown(): void {
        this.dateFilterDropdownOpen = !this.dateFilterDropdownOpen;
        this.statusFilterDropdownOpen = false;
    }

    selectBookingStatus(status: 'All statuses' | BookingStatus): void {
        this.selectedStatus = status;
        this.statusFilterDropdownOpen = false;
        this.resetPage();
    }

    selectDateFilter(date: DateFilter): void {
        this.selectedDate = date;
        this.dateFilterDropdownOpen = false;
        this.resetPage();
    }

    selectTab(tab: BookingTab): void {
        this.selectedTab = tab;
        this.resetPage();
    }

    selectBooking(booking: Booking): void {
        this.selectedBookingId = booking.bookingId;
        this.cancelConfirmationOpen = false;
    }

    formatDate(date: string): string {
        const [year, month, day] = date.split('-').map(Number);
        return new Intl.DateTimeFormat('en-MY', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }).format(new Date(year, month - 1, day));
    }

    formatShortDate(date: string): string {
        const [year, month, day] = date.split('-').map(Number);
        return new Intl.DateTimeFormat('en-MY', {
            month: 'short',
            day: 'numeric'
        }).format(new Date(year, month - 1, day));
    }

    formatCurrency(amount: number): string {
        return new Intl.NumberFormat('en-MY', {
            style: 'currency',
            currency: 'MYR',
            maximumFractionDigits: 2
        }).format(amount);
    }

    getNights(booking: Booking): number {
        const checkInTime = Date.parse(`${booking.checkIn}T00:00:00Z`);
        const checkOutTime = Date.parse(`${booking.checkOut}T00:00:00Z`);
        return (checkOutTime - checkInTime) / 86_400_000;
    }

    canCheckIn(booking: Booking): boolean {
        return booking.status === 'Confirmed'
            && booking.checkIn <= this.today
            && booking.checkOut > this.today;
    }

    canCancel(booking: Booking): boolean {
        return booking.status === 'Confirmed' && booking.checkIn > this.today;
    }

    getActionLabel(booking: Booking): string {
        if (this.canCheckIn(booking)) {
            return 'Check in';
        }
        return booking.status === 'Checked in' ? 'Check out' : 'View details';
    }

    handleBookingAction(booking: Booking): void {
        if (!this.canCheckIn(booking) && booking.status !== 'Checked in') {
            this.selectBooking(booking);
            return;
        }
        const status = booking.status === 'Checked in' ? 'Checked out' : 'Checked in';
        this.updateStatus(booking, status);
    }

    openCancelConfirmation(): void {
        this.cancelConfirmationOpen = true;
    }

    keepBooking(): void {
        this.cancelConfirmationOpen = false;
    }

    confirmCancellation(booking: Booking): void {
        this.updateStatus(booking, 'Cancelled');
        this.cancelConfirmationOpen = false;
    }

    previousPage(): void {
        if (this.currentPage > 1) {
            this.currentPage--;
        }
    }

    nextPage(): void {
        if (this.currentPage < this.pageCount) {
            this.currentPage++;
        }
    }

    @HostListener('document:click')
    closeFilterDropdowns(): void {
        this.statusFilterDropdownOpen = false;
        this.dateFilterDropdownOpen = false;
    }

    private loadBookings(): void {
        this.isLoading = true;
        this.pageError = '';
        this.roomService.getAdminBookings().subscribe({
            next: (bookings) => {
                this.bookings = bookings;
                this.selectedBookingId = bookings[0]?.bookingId || '';
                this.isLoading = false;
                this.changeDetector.markForCheck();
            },
            error: (error: unknown) => {
                this.pageError = this.errorMessage(error, 'Unable to load bookings.');
                this.isLoading = false;
                this.changeDetector.markForCheck();
            },
        });
    }

    private updateStatus(booking: Booking, status: 'Checked in' | 'Checked out' | 'Cancelled'): void {
        this.isUpdating = true;
        this.pageError = '';
        this.roomService.updateBookingStatus(booking.id, status).subscribe({
            next: (updatedBooking) => {
                this.bookings = this.bookings.map((item) =>
                    item.id === updatedBooking.id ? updatedBooking : item
                );
                this.selectedBookingId = updatedBooking.bookingId;
                this.isUpdating = false;
                this.changeDetector.markForCheck();
            },
            error: (error: unknown) => {
                this.pageError = this.errorMessage(error, 'Unable to update this booking.');
                this.isUpdating = false;
                this.changeDetector.markForCheck();
            },
        });
    }

    private errorMessage(error: unknown, fallback: string): string {
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

    private resetPage(): void {
        this.currentPage = 1;
    }
}
