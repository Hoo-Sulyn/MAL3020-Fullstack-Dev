import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Room, RoomService } from '../../../services/room.service';
import { getHotelDateValue } from '../../../services/date.utils';

@Component({
    selector: 'app-room-details',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterLink],
    templateUrl: './room-details.html',
    styleUrl: './room-details.css'
})
export class RoomDetails implements OnInit {
    bookingForm: FormGroup;
    occupancyDropdownOpen = false;
    adults = 1;
    children = 0;
    travelingWithPets = false;
    room: Room | null = null;
    isLoading = true;
    errorMessage = '';

    constructor(
        private readonly fb: FormBuilder,
        private readonly route: ActivatedRoute,
        private readonly router: Router,
        private readonly roomService: RoomService,
        private readonly changeDetector: ChangeDetectorRef
    ) {
        this.bookingForm = this.fb.group({
            'check-in-date': ['', Validators.required],
            'check-out-date': ['', Validators.required]
        });
    }

    get occupancySummary(): string {
        const adultLabel = this.adults === 1 ? 'adult' : 'adults';
        const childLabel = this.children === 1 ? 'child' : 'children';
        return `${this.adults} ${adultLabel} · ${this.children} ${childLabel}`;
    }

    ngOnInit(): void {
        const params = this.route.snapshot.queryParamMap;
        const roomId = params.get('id');
        this.bookingForm.patchValue({
            'check-in-date': params.get('checkIn') || '',
            'check-out-date': params.get('checkOut') || '',
        });
        this.adults = Math.max(1, Number(params.get('adults')) || 1);
        this.children = Math.max(0, Number(params.get('children')) || 0);
        this.travelingWithPets = params.get('travelingWithPets') === 'true';

        if (!roomId) {
            this.errorMessage = 'Select a room from the availability list first.';
            this.isLoading = false;
            return;
        }

        this.roomService.getRoom(roomId).subscribe({
            next: (room) => {
                this.room = room;
                this.isLoading = false;
                this.changeDetector.markForCheck();
            },
            error: (error: unknown) => {
                this.errorMessage = error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
                    ? error.error.message
                    : 'Unable to load this room.';
                this.isLoading = false;
                this.changeDetector.markForCheck();
            },
        });
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
        if (!this.room || this.bookingForm.invalid) {
            this.bookingForm.markAllAsTouched();
            return;
        }
        const checkIn = this.bookingForm.get('check-in-date')?.value as string;
        const checkOut = this.bookingForm.get('check-out-date')?.value as string;
        const today = getHotelDateValue();
        if (checkIn < today || checkIn >= checkOut) {
            this.errorMessage = 'Choose a check-in date today or later and a check-out date after check-in.';
            return;
        }
        if (this.adults + this.children > this.room.capacity) {
            this.errorMessage = `This room accommodates up to ${this.room.capacity} guest(s).`;
            return;
        }

        this.router.navigate(['/confirmBooking'], {
            queryParams: {
                roomId: this.room.id,
                checkIn,
                checkOut,
                adults: this.adults,
                children: this.children,
                travelingWithPets: this.travelingWithPets,
            },
        });
    }

    getNights(): number {
        const checkIn = this.bookingForm.get('check-in-date')?.value as string;
        const checkOut = this.bookingForm.get('check-out-date')?.value as string;
        if (!checkIn || !checkOut || checkIn >= checkOut) {
            return 0;
        }
        return (Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86_400_000;
    }

}
