import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';

import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Room, RoomService } from '../../../services/room.service';
import {
  getHotelDateValue,
  getNextDateValue,
  hotelDateRangeValidator,
} from '../../../services/date.utils';
import { getRoomImage } from '../../../services/room-image.utils';
import { RoomCardComponent } from '../../../components/room-card/room-card';

@Component({
  selector: 'app-hotel-booking',
  standalone: true,
  imports: [ReactiveFormsModule, RoomCardComponent],
  templateUrl: './hotel-booking.html',
  styleUrl: './hotel-booking.css',
})
export class HotelBooking implements OnInit {
  readonly today = getHotelDateValue();
  searchForm: FormGroup;
  occupancyDropdownOpen = false;
  adults = 1;
  children = 0;
  travelingWithPets = false;
  roomResults: Room[] = [];
  selectedRoomType = '';
  availableOnly = false;
  hasSearched = false;
  isSearching = false;
  isLoadingRooms = true;
  searchError = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private roomService: RoomService,
    private changeDetector: ChangeDetectorRef,
  ) {
    this.searchForm = this.fb.group(
      {
        'check-in': ['', Validators.required],
        'check-out': ['', Validators.required],
      },
      { validators: hotelDateRangeValidator('check-in', 'check-out') },
    );
  }

  get checkOutMin(): string {
    const checkIn = this.searchForm.get('check-in')?.value as string;
    return checkIn ? getNextDateValue(checkIn) : this.today;
  }

  ngOnInit(): void {
    this.roomService.getRooms().subscribe({
      next: (rooms) => {
        this.roomResults = rooms;
        this.isLoadingRooms = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.searchError = this.getErrorMessage(error);
        this.isLoadingRooms = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  get filteredRoomResults(): Room[] {
    return this.roomResults.filter(
      (room) =>
        (!this.selectedRoomType || room.type === this.selectedRoomType) &&
        (!this.availableOnly || this.hasSearched || room.status === 'Available'),
    );
  }

  updateRoomType(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      this.selectedRoomType = event.target.value;
    }
  }

  toggleAvailableOnly(): void {
    this.availableOnly = !this.availableOnly;
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
      this.searchError = this.searchForm.hasError('checkInInPast')
        ? 'Check-in must be today or later.'
        : this.searchForm.hasError('checkOutNotAfterCheckIn')
          ? 'Check-out must be after check-in.'
          : '';
      return;
    }
    const checkIn = this.searchForm.get('check-in')?.value as string;
    const checkOut = this.searchForm.get('check-out')?.value as string;
    const today = getHotelDateValue();
    if (checkIn < today || checkIn >= checkOut) {
      this.searchError =
        'Choose a check-in date today or later and a check-out date after check-in.';
      return;
    }

    this.isSearching = true;
    this.isLoadingRooms = false;
    this.searchError = '';
    this.hasSearched = true;
    this.roomService.getRooms(checkIn, checkOut, this.adults + this.children).subscribe({
      next: (rooms) => {
        this.roomResults = rooms;
        this.isSearching = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.searchError = this.getErrorMessage(error);
        this.roomResults = [];
        this.isSearching = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  onCheckInChange(): void {
    const checkIn = this.searchForm.get('check-in')?.value as string;
    const checkOutControl = this.searchForm.get('check-out');
    const checkOut = checkOutControl?.value as string;
    if (checkIn && checkOut && checkOut <= checkIn) {
      checkOutControl?.setValue('');
    }
    this.searchError = '';
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') {
      return error.error.message;
    }
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return 'Cannot reach the server. Check that the backend is running.';
    }
    return 'Unable to load rooms right now.';
  }

  viewRoom(room: Room): void {
    this.router.navigate(['/roomDetails'], {
      queryParams: {
        id: room.id,
        image: getRoomImage(room.type),
        checkIn: this.searchForm.get('check-in')?.value,
        checkOut: this.searchForm.get('check-out')?.value,
        adults: this.adults,
        children: this.children,
        travelingWithPets: this.travelingWithPets,
      },
    });
  }
}
