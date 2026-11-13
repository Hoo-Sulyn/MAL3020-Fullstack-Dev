import { expect, test } from '@playwright/test';
import {
  ADMIN_EMAIL,
  adminLogin,
  adminToken,
  bookRoomThroughUi,
  createRoom,
  futureDate,
  guestLogin,
  registerGuestViaApi,
} from './helpers';

test.describe('Booking journey (whole system)', () => {
  test.skip(!ADMIN_EMAIL, 'Set ADMIN_EMAIL and ADMIN_PASSWORD to run the booking tests.');

  test('a guest searches, books a room and sees the confirmed booking', async ({ page, request }) => {
    const token = await adminToken(request);
    const roomNumber = await createRoom(request, token);
    const guest = await registerGuestViaApi(request);

    await guestLogin(page, guest.email, guest.password);
    await expect(page).toHaveURL(/\/hotelBooking/);
    await bookRoomThroughUi(page, roomNumber, futureDate(30), futureDate(32));

    await expect(page).toHaveURL(/\/history/);
    await expect(page.getByText(/is confirmed/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel booking' })).toBeVisible();
  });

  test('a booked room is no longer offered for the same dates', async ({ page, request, browser }) => {
    const token = await adminToken(request);
    const roomNumber = await createRoom(request, token);
    const firstGuest = await registerGuestViaApi(request);
    const secondGuest = await registerGuestViaApi(request);
    const checkIn = futureDate(40);
    const checkOut = futureDate(42);

    await guestLogin(page, firstGuest.email, firstGuest.password);
    await bookRoomThroughUi(page, roomNumber, checkIn, checkOut);
    await expect(page).toHaveURL(/\/history/);

    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await guestLogin(otherPage, secondGuest.email, secondGuest.password);
    await otherPage.getByLabel('Check-in').fill(checkIn);
    await otherPage.getByLabel('Check-out').fill(checkOut);
    await otherPage.locator('.search-button').click();

    await expect(otherPage.locator('app-room-card').first()).toBeVisible();
    await expect(
      otherPage.locator('app-room-card').filter({ hasText: `Room ${roomNumber}` })
    ).toHaveCount(0);
    await otherContext.close();
  });

  test('the admin sees a guest booking appear live, without refreshing (WebSockets)', async ({
    page,
    request,
    browser,
  }) => {
    const token = await adminToken(request);
    const roomNumber = await createRoom(request, token);
    const guest = await registerGuestViaApi(request);

    // Admin opens the bookings page and leaves it alone.
    await adminLogin(page);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/bookingManagement');
    await expect(page.getByRole('heading', { name: 'Bookings management' })).toBeVisible();
    await expect(page.getByRole('button', { name: guest.fullName })).toHaveCount(0);

    // A different browser (a different person) makes the booking.
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestLogin(guestPage, guest.email, guest.password);
    await bookRoomThroughUi(guestPage, roomNumber, futureDate(50), futureDate(52));
    await expect(guestPage).toHaveURL(/\/history/);

    // The admin page was never reloaded, so this row can only arrive over the socket.
    await expect(page.getByRole('button', { name: guest.fullName })).toBeVisible({
      timeout: 15_000,
    });
    await guestContext.close();
  });
});
