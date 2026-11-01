import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Room } from '../../services/room.service';
import { getRoomImage } from '../../services/room-image.utils';

@Component({
    selector: 'app-room-card',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="room-card">
        <div id="room-image-container">
            <img [src]="roomImage" [alt]="room.type + ' room'">
        </div>
        <div class="room-detail">
            <h3 id="listing-room-type">{{ room.type }}</h3>
            <p id="room-description">Room {{ room.number }} · Floor {{ room.floor }} · {{ room.description }}</p>

            <p id="room-amenities">{{ room.amenities }} · Up to {{ room.capacity }} guests</p>

            <div class="divider"></div>

            <div class="bottom-row-details">
                <div id="room-pricing">
                    <p id="price-per-night"><span id="price-container">RM <span id="price">{{ room.nightlyRate | number:'1.2-2' }}</span></span> / night</p>
                    <p id="total-price-container"><span id="total-price">RM {{ totalPrice | number:'1.2-2' }}</span> total for <span id="total-nights">{{ totalNights }}</span> night(s)</p>
                </div>

                <div id="view-details-container">
                    <button type="button" id="view-details-btn" (click)="viewDetails.emit(room)">View details</button>
                </div>
            </div>
        </div>
    </div>
    `,
    styleUrls: ['./room-card.css']
})

export class RoomCardComponent {
    @Input() room!: Room;
    @Input() checkIn = '';
    @Input() checkOut = '';
    @Output() viewDetails = new EventEmitter<Room>();

    get roomImage(): string {
        return getRoomImage(this.room.type);
    }

    get totalNights(): number {
        if (!this.checkIn || !this.checkOut || this.checkIn >= this.checkOut) {
            return 1;
        }
        return (Date.parse(`${this.checkOut}T00:00:00Z`) - Date.parse(`${this.checkIn}T00:00:00Z`)) / 86_400_000;
    }

    get totalPrice(): number {
        return this.room.nightlyRate * this.totalNights;
    }
}