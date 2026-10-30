import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
    selector: 'app-guest-header',
    templateUrl: './guestHeader.html',
    styleUrls: ['./guestHeader.css'],
    imports: [RouterLink, RouterLinkActive]
})

export class GuestHeader {
    constructor(private router: Router) {}

    get roomsSectionActive(): boolean {
        const currentPath = this.router.url.split(/[?#]/, 1)[0].replace(/\/$/, '');
        return ['/hotelBooking', '/roomDetails', '/confirmBooking'].includes(currentPath);
    }
}