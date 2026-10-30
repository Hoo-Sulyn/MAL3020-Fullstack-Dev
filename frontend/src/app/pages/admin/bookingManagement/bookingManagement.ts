import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';

type BookingStatus = 'Confirmed' | 'Checked in' | 'Checked out' | 'Cancelled';
type BookingTab = 'all' | 'arrivals' | 'departures';
type DateFilter = 'All dates' | 'Today' | 'Upcoming' | 'Past';

interface Booking {
    guestName: string;
    bookingId: string;
    room: string;
    checkIn: string;
    checkOut: string;
    status: BookingStatus;
    total: number;
    email: string;
    phone: string;
    adults: number;
}

@Component({
    selector: 'app-booking-management',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './bookingManagement.html',
    styleUrl: './bookingManagement.css'
})

export class BookingManagement {
    readonly today = '2026-10-16';
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
    selectedBookingId = 'HV-2048';
    searchQuery = '';
    currentPage = 1;
    cancelConfirmationOpen = false;

    bookings: Booking[] = [
        {
            guestName: 'Emma Wilson',
            bookingId: 'HV-2048',
            room: '201 · Superior King',
            checkIn: '2026-10-16',
            checkOut: '2026-10-19',
            status: 'Confirmed',
            total: 444,
            email: 'emma.wilson@example.com',
            phone: '+44 7700 900 218',
            adults: 2
        },
        {
            guestName: 'Lucas Martin',
            bookingId: 'HV-2047',
            room: '104 · Garden Suite',
            checkIn: '2026-10-16',
            checkOut: '2026-10-18',
            status: 'Confirmed',
            total: 252,
            email: 'lucas.martin@example.com',
            phone: '+44 7700 900 217',
            adults: 2
        },
        {
            guestName: 'Olivia Chen',
            bookingId: 'HV-2046',
            room: '302 · River View Double',
            checkIn: '2026-10-14',
            checkOut: '2026-10-17',
            status: 'Checked in',
            total: 516,
            email: 'olivia.chen@example.com',
            phone: '+44 7700 900 216',
            adults: 2
        },
        {
            guestName: 'Noah Williams',
            bookingId: 'HV-2045',
            room: '203 · Superior King',
            checkIn: '2026-10-17',
            checkOut: '2026-10-20',
            status: 'Confirmed',
            total: 444,
            email: 'noah.williams@example.com',
            phone: '+44 7700 900 215',
            adults: 3
        },
        {
            guestName: 'Isabella Rossi',
            bookingId: 'HV-2044',
            room: '106 · Classic Double',
            checkIn: '2026-10-13',
            checkOut: '2026-10-16',
            status: 'Checked out',
            total: 384,
            email: 'isabella.rossi@example.com',
            phone: '+44 7700 900 214',
            adults: 2
        },
        {
            guestName: 'James Taylor',
            bookingId: 'HV-2043',
            room: '202 · Superior King',
            checkIn: '2026-10-18',
            checkOut: '2026-10-21',
            status: 'Cancelled',
            total: 444,
            email: 'james.taylor@example.com',
            phone: '+44 7700 900 213',
            adults: 2
        }
    ];

    get filteredBookings(): Booking[] {
        const query = this.searchQuery.trim().toLowerCase();

        return this.bookings.filter(booking => {
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
                    && booking.checkOut >= this.today)
                || (this.selectedDate === 'Upcoming' && booking.checkIn > this.today)
                || (this.selectedDate === 'Past' && booking.checkOut < this.today);

            return matchesSearch && matchesStatus && matchesTab && matchesDate;
        });
    }

    get selectedBooking(): Booking | null {
        return this.filteredBookings.find(booking => booking.bookingId === this.selectedBookingId)
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
        return this.bookings.filter(booking =>
            booking.checkIn === this.today && booking.status !== 'Cancelled'
        ).length;
    }

    get departuresToday(): number {
        return this.bookings.filter(booking =>
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
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }).format(new Date(year, month - 1, day));
    }

    formatShortDate(date: string): string {
        const [year, month, day] = date.split('-').map(Number);
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric'
        }).format(new Date(year, month - 1, day));
    }

    formatCurrency(amount: number): string {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        }).format(amount);
    }

    getNights(booking: Booking): number {
        const [checkInYear, checkInMonth, checkInDay] = booking.checkIn.split('-').map(Number);
        const [checkOutYear, checkOutMonth, checkOutDay] = booking.checkOut.split('-').map(Number);
        const checkInTime = Date.UTC(checkInYear, checkInMonth - 1, checkInDay);
        const checkOutTime = Date.UTC(checkOutYear, checkOutMonth - 1, checkOutDay);
        return (checkOutTime - checkInTime) / 86_400_000;
    }

    canCheckIn(booking: Booking): boolean {
        return booking.status === 'Confirmed' && booking.checkIn <= this.today;
    }

    getActionLabel(booking: Booking): string {
        if (this.canCheckIn(booking)) {
            return 'Check in';
        }
        return booking.status === 'Checked in' ? 'Check out' : 'View details';
    }

    handleBookingAction(booking: Booking): void {
        this.selectBooking(booking);

        if (this.canCheckIn(booking)) {
            booking.status = 'Checked in';
        } else if (booking.status === 'Checked in') {
            booking.status = 'Checked out';
        }
    }

    openCancelConfirmation(): void {
        this.cancelConfirmationOpen = true;
    }

    keepBooking(): void {
        this.cancelConfirmationOpen = false;
    }

    confirmCancellation(booking: Booking): void {
        booking.status = 'Cancelled';
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

    private resetPage(): void {
        this.currentPage = 1;
    }
}