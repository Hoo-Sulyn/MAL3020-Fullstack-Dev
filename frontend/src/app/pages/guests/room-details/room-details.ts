import { ChangeDetectorRef, Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Room, RoomService } from '../../../services/room.service';
import {
  getHotelDateValue,
  getNextDateValue,
  hotelDateRangeValidator,
} from '../../../services/date.utils';
import { getRoomImage } from '../../../services/room-image.utils';

@Component({
  selector: 'app-room-details',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './room-details.html',
  styleUrl: './room-details.css',
})
export class RoomDetails implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly roomService = inject(RoomService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly today = getHotelDateValue();
  bookingForm: FormGroup;
  occupancyDropdownOpen = false;
  adults = 1;
  children = 0;
  travelingWithPets = false;
  room: Room | null = null;
  roomImage = 'image-not-available.png';
  isHistoryView = false;
  bookingId = '';
  bookingStatus = '';
  bookingTotal: number | null = null;
  bookingNightlyRate: number | null = null;
  isLoading = true;
  errorMessage = '';

  constructor() {
    this.bookingForm = this.fb.group(
      {
        'check-in-date': ['', Validators.required],
        'check-out-date': ['', Validators.required],
      },
      { validators: hotelDateRangeValidator('check-in-date', 'check-out-date') },
    );
  }

  get checkOutMin(): string {
    const checkIn = this.bookingForm.get('check-in-date')?.value as string;
    return checkIn ? getNextDateValue(checkIn) : this.today;
  }

  get occupancySummary(): string {
    const adultLabel = this.adults === 1 ? 'adult' : 'adults';
    const childLabel = this.children === 1 ? 'child' : 'children';
    return `${this.adults} ${adultLabel} · ${this.children} ${childLabel}`;
  }

  get displayedNightlyRate(): number {
    return this.isHistoryView && this.bookingNightlyRate !== null
      ? this.bookingNightlyRate
      : (this.room?.nightlyRate ?? 0);
  }

  get displayedTotal(): number {
    return this.isHistoryView && this.bookingTotal !== null
      ? this.bookingTotal
      : this.displayedNightlyRate * this.getNights();
  }

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const roomId = params.get('id');
    const passedImage = params.get('image');
    this.isHistoryView = params.get('fromHistory') === 'true';
    this.bookingId = this.isHistoryView ? params.get('bookingId') || '' : '';
    this.bookingStatus = this.isHistoryView ? params.get('bookingStatus') || '' : '';
    this.bookingTotal = this.readAmount(params.get('bookingTotal'));
    this.bookingNightlyRate = this.readAmount(params.get('nightlyRate'));
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
        const expectedImage = getRoomImage(room.type);
        this.roomImage = passedImage === expectedImage ? passedImage : expectedImage;
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.errorMessage =
          error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
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
    if (this.isHistoryView) {
      return;
    }
    if (this.bookingForm.invalid) {
      this.bookingForm.markAllAsTouched();
      this.errorMessage = this.bookingForm.hasError('checkInInPast')
        ? 'Check-in must be today or later.'
        : this.bookingForm.hasError('checkOutNotAfterCheckIn')
          ? 'Check-out must be after check-in.'
          : '';
      return;
    }
    if (!this.room) {
      return;
    }
    const checkIn = this.bookingForm.get('check-in-date')?.value as string;
    const checkOut = this.bookingForm.get('check-out-date')?.value as string;
    const today = getHotelDateValue();
    if (checkIn < today || checkIn >= checkOut) {
      this.errorMessage =
        'Choose a check-in date today or later and a check-out date after check-in.';
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

  backToHistory(): void {
    void this.router.navigateByUrl('/history');
  }

  private readAmount(value: string | null): number | null {
    if (!value) {
      return null;
    }
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
  }

  onCheckInChange(): void {
    const checkIn = this.bookingForm.get('check-in-date')?.value as string;
    const checkOutControl = this.bookingForm.get('check-out-date');
    const checkOut = checkOutControl?.value as string;
    if (checkIn && checkOut && checkOut <= checkIn) {
      checkOutControl?.setValue('');
    }
    this.errorMessage = '';
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
