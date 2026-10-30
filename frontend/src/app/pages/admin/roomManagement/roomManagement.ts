import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

type RoomStatus = 'Available' | 'Occupied' | 'Maintenance';

interface Room {
    number: string;
    type: string;
    details: string;
    capacity: number;
    nightlyRate: number;
    status: RoomStatus;
}

@Component({
    selector: 'app-room-management',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './roomManagement.html',
    styleUrl: './roomManagement.css'
})

export class RoomManagement {
    statusFilterDropdownOpen = false;
    selectedStatus = 'All statuses';
    roomStatusDropdownOpen: string | null = null;
    roomStatuses: RoomStatus[] = ['Available', 'Occupied', 'Maintenance'];
    roomStatusFilters = ['All statuses', ...this.roomStatuses];
    searchQuery = '';
    rooms: Room[] = [
        {
            number: '000',
            type: 'Room Type',
            details: 'Room details',
            capacity: 2,
            nightlyRate: 0,
            status: 'Available'
        }
    ];

    get filteredRooms(): Room[] {
        const query = this.searchQuery.trim().toLowerCase();

        return this.rooms.filter(room => {
            const matchesSearch = !query
                || room.number.toLowerCase().includes(query)
                || room.type.toLowerCase().includes(query)
                || room.details.toLowerCase().includes(query);
            const matchesStatus = this.selectedStatus === 'All statuses'
                || room.status.toLowerCase() === this.selectedStatus.toLowerCase();

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

    selectStatusFilter(status: string): void {
        this.selectedStatus = status;
        this.statusFilterDropdownOpen = false;
    }

    toggleRoomStatusDropdown(roomNumber: string): void {
        this.roomStatusDropdownOpen = this.roomStatusDropdownOpen === roomNumber
            ? null
            : roomNumber;
    }

    selectRoomStatus(room: Room, status: RoomStatus): void {
        room.status = status;
        this.roomStatusDropdownOpen = null;
    }

    @HostListener('document:click')
    closeDropdowns(): void {
        this.statusFilterDropdownOpen = false;
        this.roomStatusDropdownOpen = null;
    }
}