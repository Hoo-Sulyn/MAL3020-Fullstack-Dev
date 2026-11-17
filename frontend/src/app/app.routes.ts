import { Routes } from '@angular/router';
import { GuestLogin } from './pages/guests/login/guestLogin';
import { GuestRegister } from './pages/guests/register/register';
import { HotelBooking } from './pages/guests/hotel-booking/hotel-booking';
import { RoomDetails } from './pages/guests/room-details/room-details';
import { ConfirmBooking } from './pages/guests/confirmBooking/confirmBooking';
import { History } from './pages/guests/history/history';
import { authGuard } from './guards/auth.guard';

import { AdminLogin } from './pages/admin/adminLogin/adminLogin';
import { Dashboard } from './pages/admin/dashboard/dashboard';
import { RoomManagement } from './pages/admin/roomManagement/roomManagement';
import { BookingManagement } from './pages/admin/bookingManagement/bookingManagement';

export const routes: Routes = [
    // GUEST INTERFACE
    { path: '', component: GuestLogin },
    { path: 'guestRegister', component: GuestRegister },
    { path: 'hotelBooking', canActivate: [authGuard('guest')], component: HotelBooking },
    { path: 'roomDetails', canActivate: [authGuard('guest')], component: RoomDetails },
    { path: 'confirmBooking', canActivate: [authGuard('guest')], component: ConfirmBooking },
    { path: 'history', canActivate: [authGuard('guest')], component: History },
    { path: 'profile', canActivate: [authGuard('guest')], loadComponent: () => import('./pages/guests/profile/profile').then(({ Profile }) => Profile) },
    
    // ADMIN INTERFACE
    { path: 'adminLogin', component: AdminLogin },
    { path: 'dashboard', canActivate: [authGuard('admin')], component: Dashboard },
    { path: 'roomManagement', canActivate: [authGuard('admin')], component: RoomManagement },
    { path: 'bookingManagement', canActivate: [authGuard('admin')], component: BookingManagement}

];
