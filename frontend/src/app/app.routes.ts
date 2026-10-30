import { Routes } from '@angular/router';
import { GuestLogin } from './pages/guests/login/guestLogin';
import { GuestRegister } from './pages/guests/register/register';
import { HotelBooking } from './pages/guests/hotel-booking/hotel-booking';
import { RoomDetails } from './pages/guests/room-details/room-details';
import { ConfirmBooking } from './pages/guests/confirmBooking/confirmBooking';
import { History } from './pages/guests/history/history';
import { Profile } from './pages/guests/profile/profile';

import { AdminLogin } from './pages/admin/adminLogin/adminLogin';
import { Dashboard } from './pages/admin/dashboard/dashboard';
import { RoomManagement } from './pages/admin/roomManagement/roomManagement';
import { BookingManagement } from './pages/admin/bookingManagement/bookingManagement';

export const routes: Routes = [
    // GUEST INTERFACE
    { path: '', component: GuestLogin },
    { path: 'guestRegister', component: GuestRegister },
    { path: 'hotelBooking', component: HotelBooking },
    { path: 'roomDetails', component: RoomDetails },
    { path: 'confirmBooking', component: ConfirmBooking },
    { path: 'history', component: History },
    { path: 'profile', component: Profile },
    
    // ADMIN INTERFACE
    { path: 'adminLogin', component: AdminLogin },
    { path: 'dashboard', component: Dashboard },
    { path: 'roomManagement', component: RoomManagement },
    { path: 'bookingManagement', component: BookingManagement}

];
