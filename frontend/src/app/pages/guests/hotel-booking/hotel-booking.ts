import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-hotel-booking',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterLink],
    templateUrl: './hotel-booking.html',
    styleUrl: './hotel-booking.css'
})

export class HotelBooking {
    searchForm: FormGroup;
    occupancyDropdownOpen = false;
    adults = 1;
    children = 0;
    rooms = 1;
    travelingWithPets = false;

    constructor(private fb: FormBuilder){
        this.searchForm = this.fb.group({
            'check-in': ['', Validators.required],
            'check-out': ['', Validators.required]
        })
    }

    toggleOccupancyDropdown(): void {
        this.occupancyDropdownOpen = !this.occupancyDropdownOpen;
    }

    increaseCount(type: 'adults' | 'children' | 'rooms'): void {
        this[type] += 1;
    }

    decreaseCount(type: 'adults' | 'children' | 'rooms'): void {
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
        }
    }
}