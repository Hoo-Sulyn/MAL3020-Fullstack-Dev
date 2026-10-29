import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

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