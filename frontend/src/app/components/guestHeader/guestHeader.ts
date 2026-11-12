import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService, AuthUser } from '../../services/auth.service';
import { RealtimeService } from '../../services/realtime.service';

@Component({
  selector: 'app-guest-header',
  templateUrl: './guestHeader.html',
  styleUrls: ['./guestHeader.css'],
  imports: [RouterLink, RouterLinkActive],
})
export class GuestHeader {
  constructor(
    private readonly router: Router,
    private readonly auth: AuthService,
    private readonly realtime: RealtimeService,
  ) {}

  get guestUser(): AuthUser | null {
    const user = this.auth.getCurrentUser();
    return user?.role === 'guest' && this.realtime.isConnected() ? user : null;
  }

  signOut(): void {
    if (!window.confirm('Are you sure you want to sign out?')) {
      return;
    }

    this.auth.logout();
    this.realtime.disconnect();
    void this.router.navigateByUrl('/');
  }

  get roomsSectionActive(): boolean {
    const currentPath = this.router.url.split(/[?#]/, 1)[0].replace(/\/$/, '');
    return ['/hotelBooking', '/roomDetails', '/confirmBooking'].includes(currentPath);
  }
}
