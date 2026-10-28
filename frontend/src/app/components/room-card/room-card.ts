import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-room-card',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="room-card">
        <div id="room-image-container">
            <img src="image-not-available.png" alt="Hotel room picture">
        </div>
        <div class="room-detail">
            <h3 id="listing-room-type">Room Name</h3>
            <p id="room-description">Room description</p>

            <div class="room-rating-reviews">
                <small id="room-rating">0.0</small>
                <small id="rating-class">No rating</small>
                <small id="room-reviews">• <span id="reviews-count">0</span> reviews</small>
            </div>

            <p id="room-amenities">Amenities</p>

            <div class="divider"></div>

            <div class="bottom-row-details">
                <div id="room-pricing">
                    <p id="price-per-night"><span id="price-container">RM <span id="price">0</span></span> / night</p>
                    <p id="total-price-container"><span id="total-price">RM 0</span> total for <span id="total-nights">1</span> night(s)</p>
                </div>

                <div id="view-details-container">
                    <button type="button" id="view-details-btn">View details</button>
                </div>
            </div>
        </div>
    </div>
    `,
    styleUrls: ['./room-card.css']
})

export class RoomCardComponent {
    @Input() room: any;
}