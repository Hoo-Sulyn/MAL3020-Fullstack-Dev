import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService, AuthUser } from '../../services/auth.service';
import { RealtimeService } from '../../services/realtime.service';

@Component({
  selector: 'app-admin-header',
  templateUrl: './adminHeader.html',
  styleUrls: ['./adminHeader.css'],
  imports: [RouterLink, RouterLinkActive],
})
export class AdminHeader {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);

  get adminUser(): AuthUser | null {
    const user = this.auth.getCurrentUser();
    return user?.role === 'admin' && this.realtime.isConnected() ? user : null;
  }

  signOut(): void {
    if (!window.confirm('Are you sure you want to sign out?')) {
      return;
    }

    this.auth.logout();
    this.realtime.disconnect();
    void this.router.navigateByUrl('/adminLogin');
  }
}
