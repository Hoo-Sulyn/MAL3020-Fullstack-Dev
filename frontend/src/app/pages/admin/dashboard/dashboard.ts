import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface Booking {
    guestName: string;
    bookingId: string;
    room: string;
    checkIn: string;
    checkOut: string;
    status: string;
    total: string;
    action: string;
}

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './dashboard.html',
    styleUrl: './dashboard.css'
})

export class Dashboard {
    statusFilterDropdownOpen = false;
    selectedStatus = 'All statuses';
    bookingStatuses = ['All statuses', 'Confirmed', 'Checked in', 'Checked out', 'Cancelled'];
    searchQuery = '';
    bookings: Booking[] = [
        {
            guestName: 'Guest name',
            bookingId: 'HV-0000',
            room: 'Room name',
            checkIn: 'Oct 01, 2026',
            checkOut: 'Oct 01, 2026',
            status: 'Confirmed',
            total: 'RM 0',
            action: 'Check in'
        }
    ];

    get filteredBookings(): Booking[] {
        const query = this.searchQuery.trim().toLowerCase();

        return this.bookings.filter(booking => {
            const matchesSearch = !query
                || booking.guestName.toLowerCase().includes(query)
                || booking.bookingId.toLowerCase().includes(query);
            const matchesStatus = this.selectedStatus === 'All statuses'
                || booking.status.toLowerCase() === this.selectedStatus.toLowerCase();

            return matchesSearch && matchesStatus;
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

    selectBookingStatus(status: string): void {
        this.selectedStatus = status;
        this.statusFilterDropdownOpen = false;
    }

    @HostListener('document:click')
    closeStatusFilterDropdown(): void {
        this.statusFilterDropdownOpen = false;
    }
}