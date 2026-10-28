import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-room-details',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterLink],
    templateUrl: './room-details.html',
    styleUrl: './room-details.css'
})

export class RoomDetails {
    bookingForm: FormGroup;
    occupancyDropdownOpen = false;
    adults = 1;
    children = 0;
    rooms = 1;
    travelingForWork = false;
    travelingWithPets = false;

    constructor(private fb: FormBuilder){
        this.bookingForm = this.fb.group({
            'check-in-date': ['', Validators.required],
            'check-out-date': ['', Validators.required]
        })
    }

    get occupancySummary(): string {
        const adultLabel = this.adults === 1 ? 'adult' : 'adults';
        const childLabel = this.children === 1 ? 'child' : 'children';
        const roomLabel = this.rooms === 1 ? 'room' : 'rooms';
        return `${this.adults} ${adultLabel} · ${this.children} ${childLabel} · ${this.rooms} ${roomLabel}`;
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

    onSubmit(){
        
    }
}