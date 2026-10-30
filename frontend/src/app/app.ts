import { Component, signal } from '@angular/core';
import { RouterLink, RouterOutlet, Router } from '@angular/router';
import { GuestHeader } from './components/guestHeader/guestHeader';
import { GuestFooter } from './components/guestFooter/guestFooter';
import { AdminHeader } from './components/adminHeader/adminHeader';
import { AdminFooter } from './components/adminFooter/adminFooter';

@Component({
  imports: [RouterLink, RouterOutlet, GuestHeader, GuestFooter, AdminHeader, AdminFooter],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('frontend');

  constructor(protected router: Router) {}

  private get currentPath(): string {
    return this.router.url.split('?')[0];
  }

  get showAdminLayout(): boolean {
    return !['/', '/guestRegister', '/hotelBooking', '/roomDetails', '/confirmBooking', '/history', '/profile', '/adminLogin'].includes(this.currentPath);
  }

  get showGuestHeader(): boolean {
    return !['/', '/guestRegister', '/adminLogin', '/dashboard', '/roomManagement', '/bookingManagement'].includes(this.currentPath);
  }

  get showGuestFooter(): boolean {
    return !['/adminLogin', '/dashboard', '/roomManagement', '/bookingManagement'].includes(this.currentPath);
  }
}
