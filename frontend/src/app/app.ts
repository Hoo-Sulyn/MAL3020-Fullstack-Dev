import { Component, signal } from '@angular/core';
import { RouterLink, RouterOutlet, Router } from '@angular/router';
import { GuestHeader } from './components/guestHeader/guestHeader';
import { GuestFooter } from './components/guestFooter/guestFooter';

@Component({
  imports: [RouterLink, RouterOutlet, GuestHeader, GuestFooter],
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

  get showGuestHeader(): boolean {
    return !['/', '/guestRegister', '/adminLogin'].includes(this.currentPath);
  }

  get showGuestFooter(): boolean {
    return this.currentPath !== '/adminLogin';
  }
}
