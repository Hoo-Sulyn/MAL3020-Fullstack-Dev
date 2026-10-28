import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-history',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './history.html',
    styleUrl: './history.css'
})

export class History {

}