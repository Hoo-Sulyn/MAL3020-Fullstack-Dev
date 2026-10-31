import { ChangeDetectorRef, Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Room, RoomService } from '../../../services/room.service';
import { getHotelDateValue } from '../../../services/date.utils';

@Component({
    selector: 'app-hotel-booking',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './hotel-booking.html',
    styleUrl: './hotel-booking.css'
})

export class HotelBooking {
    searchForm: FormGroup;
    occupancyDropdownOpen = false;
    adults = 1;
    children = 0;
    travelingWithPets = false;
    roomResults: Room[] = [];
    hasSearched = false;
    isSearching = false;
    searchError = '';

    constructor(
        private fb: FormBuilder,
        private router: Router,
        private roomService: RoomService,
        private changeDetector: ChangeDetectorRef
    ){
        this.searchForm = this.fb.group({
            'check-in': ['', Validators.required],
            'check-out': ['', Validators.required]
        })
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
        if (this.searchForm.invalid) {
            this.searchForm.markAllAsTouched();
            return;
        }
        const checkIn = this.searchForm.get('check-in')?.value as string;
        const checkOut = this.searchForm.get('check-out')?.value as string;
        const today = getHotelDateValue();
        if (checkIn < today || checkIn >= checkOut) {
            this.searchError = 'Choose a check-in date today or later and a check-out date after check-in.';
            this.roomResults = [];
            this.hasSearched = true;
            return;
        }

        this.isSearching = true;
        this.searchError = '';
        this.hasSearched = true;
        this.roomService.getRooms(checkIn, checkOut, this.adults + this.children).subscribe({
            next: (rooms) => {
                this.roomResults = rooms;
                this.isSearching = false;
                this.changeDetector.markForCheck();
            },
            error: (error: unknown) => {
                this.searchError = error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
                    ? error.error.message
                    : error instanceof HttpErrorResponse && error.status === 0
                        ? 'Cannot reach the server. Check that the backend is running.'
                        : 'Unable to search rooms right now.';
                this.roomResults = [];
                this.isSearching = false;
                this.changeDetector.markForCheck();
            },
        });
    }

    viewRoom(room: Room): void {
        this.router.navigate(['/roomDetails'], {
            queryParams: {
                id: room.id,
                checkIn: this.searchForm.get('check-in')?.value,
                checkOut: this.searchForm.get('check-out')?.value,
                adults: this.adults,
                children: this.children,
                travelingWithPets: this.travelingWithPets,
            },
        });
    }
}