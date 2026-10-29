import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink} from '@angular/router';

@Component({
    selector: 'app-room-management',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './roomManagement.html',
    styleUrl: './roomManagement.css'
})

export class RoomManagement {
    
}