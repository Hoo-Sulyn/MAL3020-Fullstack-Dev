import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Room,
  RoomPayload,
  RoomService,
  RoomStatus,
  RoomStatusOverride,
} from '../../../services/room.service';
import { getHotelDateValue } from '../../../services/date.utils';

const ROOM_TYPES = ['Superior King', 'Garden Suite', 'River View Double'];
const ROOM_STATUSES: RoomStatus[] = ['Available', 'Occupied', 'Maintenance'];
const STATUS_OPTIONS: RoomStatusOverride[] = ['Automatic', ...ROOM_STATUSES];

@Component({
  selector: 'app-room-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './roomManagement.html',
  styleUrl: './roomManagement.css',
})
export class RoomManagement implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly roomService = inject(RoomService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly roomTypes = ROOM_TYPES;
  readonly roomStatuses = ROOM_STATUSES;
  readonly statusOptions = STATUS_OPTIONS;
  readonly roomStatusFilters = ['All statuses', ...ROOM_STATUSES];
  readonly todayLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${getHotelDateValue()}T00:00:00`));

  statusFilterDropdownOpen = false;
  selectedStatus = 'All statuses';
  roomStatusDropdownOpen: string | null = null;
  searchQuery = '';
  rooms: Room[] = [];
  showAddRoom = false;
  editingRoom: Room | null = null;
  deletingRoom: Room | null = null;
  isLoading = true;
  isSaving = false;
  pageError = '';
  addError = '';
  editError = '';
  deleteError = '';
  addRoomForm: FormGroup;
  editRoomForm: FormGroup;

  constructor() {
    this.addRoomForm = this.createRoomForm();
    this.editRoomForm = this.createRoomForm();
  }

  ngOnInit(): void {
    this.loadRooms();
  }

  get filteredRooms(): Room[] {
    const query = this.searchQuery.trim().toLowerCase();
    return this.rooms.filter((room) => {
      const matchesSearch =
        !query ||
        room.number.toLowerCase().includes(query) ||
        room.type.toLowerCase().includes(query) ||
        this.roomDetails(room).toLowerCase().includes(query);
      const matchesStatus =
        this.selectedStatus === 'All statuses' || room.status === this.selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }

  get availableCount(): number {
    return this.rooms.filter((room) => room.status === 'Available').length;
  }

  get occupiedCount(): number {
    return this.rooms.filter((room) => room.status === 'Occupied').length;
  }

  get maintenanceCount(): number {
    return this.rooms.filter((room) => room.status === 'Maintenance').length;
  }

  roomDetails(room: Room): string {
    return [`Floor ${room.floor}`, room.description, room.amenities].join(' • ');
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
    this.roomStatusDropdownOpen = this.roomStatusDropdownOpen === roomNumber ? null : roomNumber;
  }

  selectRoomStatus(room: Room, status: RoomStatusOverride): void {
    this.roomStatusDropdownOpen = null;
    this.pageError = '';
    this.roomService.updateRoomStatus(room.id, status).subscribe({
      next: (updatedRoom) => {
        this.replaceRoom(updatedRoom);
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.pageError = this.errorMessage(error, 'Unable to update the room status.');
        this.changeDetector.markForCheck();
      },
    });
  }

  openAddRoom(): void {
    this.showAddRoom = true;
    this.addError = '';
  }

  closeAddRoom(): void {
    this.showAddRoom = false;
    this.addError = '';
    this.addRoomForm.reset(this.emptyRoomFormValue());
  }

  createRoom(): void {
    if (this.addRoomForm.invalid || this.isSaving) {
      this.addRoomForm.markAllAsTouched();
      return;
    }
    this.isSaving = true;
    this.addError = '';
    this.roomService.createRoom(this.formPayload(this.addRoomForm)).subscribe({
      next: (room) => {
        this.rooms = [...this.rooms, room].sort((a, b) => a.number.localeCompare(b.number));
        this.closeAddRoom();
        this.isSaving = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.addError = this.errorMessage(error, 'Unable to create the room.');
        this.isSaving = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  openEditRoom(room: Room): void {
    this.editingRoom = room;
    this.editError = '';
    this.editRoomForm.reset({
      number: room.number,
      type: room.type,
      floor: room.floor,
      description: room.description,
      amenities: room.amenities,
      capacity: room.capacity,
      nightlyRate: room.nightlyRate,
      status: room.statusOverride,
    });
  }

  closeEditRoom(): void {
    this.editingRoom = null;
    this.editError = '';
  }

  saveRoomChanges(): void {
    if (!this.editingRoom || this.editRoomForm.invalid || this.isSaving) {
      this.editRoomForm.markAllAsTouched();
      return;
    }
    this.isSaving = true;
    this.editError = '';
    this.roomService
      .updateRoom(this.editingRoom.id, this.formPayload(this.editRoomForm))
      .subscribe({
        next: (room) => {
          this.replaceRoom(room);
          this.closeEditRoom();
          this.isSaving = false;
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.editError = this.errorMessage(error, 'Unable to save room changes.');
          this.isSaving = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  openDeleteRoom(room: Room): void {
    this.deletingRoom = room;
    this.deleteError = '';
  }

  closeDeleteRoom(): void {
    this.deletingRoom = null;
    this.deleteError = '';
  }

  confirmDeleteRoom(): void {
    if (!this.deletingRoom || this.isSaving) {
      return;
    }
    const deletingRoomId = this.deletingRoom.id;
    this.isSaving = true;
    this.deleteError = '';
    this.roomService.deleteRoom(deletingRoomId).subscribe({
      next: () => {
        this.rooms = this.rooms.filter((room) => room.id !== deletingRoomId);
        if (this.editingRoom?.id === deletingRoomId) {
          this.closeEditRoom();
        }
        this.closeDeleteRoom();
        this.isSaving = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.deleteError = this.errorMessage(error, 'Unable to delete the room.');
        this.isSaving = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  @HostListener('document:click')
  closeDropdowns(): void {
    this.statusFilterDropdownOpen = false;
    this.roomStatusDropdownOpen = null;
  }

  private loadRooms(): void {
    this.isLoading = true;
    this.pageError = '';
    this.roomService.getAdminRooms().subscribe({
      next: (rooms) => {
        this.rooms = rooms;
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.pageError = this.errorMessage(error, 'Unable to load rooms.');
        this.isLoading = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  private createRoomForm(): FormGroup {
    return this.fb.group({
      number: ['', [Validators.required, Validators.maxLength(20)]],
      type: ['', Validators.required],
      floor: [0, [Validators.required, Validators.min(0)]],
      description: ['', [Validators.required, Validators.maxLength(500)]],
      amenities: ['', [Validators.required, Validators.maxLength(500)]],
      capacity: [1, [Validators.required, Validators.min(1)]],
      nightlyRate: [0, [Validators.required, Validators.min(0)]],
      status: ['Automatic', Validators.required],
    });
  }

  private emptyRoomFormValue(): Record<string, string | number> {
    return {
      number: '',
      type: '',
      floor: 0,
      description: '',
      amenities: '',
      capacity: 1,
      nightlyRate: 0,
      status: 'Automatic',
    };
  }

  private formPayload(form: FormGroup): RoomPayload {
    const value = form.getRawValue();
    return {
      number: String(value.number).trim(),
      type: String(value.type),
      floor: Number(value.floor),
      description: String(value.description).trim(),
      amenities: String(value.amenities).trim(),
      capacity: Number(value.capacity),
      nightlyRate: Number(value.nightlyRate),
      status: value.status as RoomStatusOverride,
    };
  }

  private replaceRoom(updatedRoom: Room): void {
    this.rooms = this.rooms.map((room) => (room.id === updatedRoom.id ? updatedRoom : room));
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Cannot reach the server. Check that the backend is running and accessible.';
      }
      if (typeof error.error?.message === 'string') {
        return error.error.message;
      }
    }
    return fallback;
  }
}
