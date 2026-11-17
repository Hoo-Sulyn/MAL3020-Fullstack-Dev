import { expect, test } from '@playwright/test';
import { guestLogin, registerGuestViaApi } from './helpers';

const adminPages = ['/dashboard', '/roomManagement', '/bookingManagement'];
const guestPages = ['/hotelBooking', '/history', '/profile', '/confirmBooking', '/roomDetails'];

test.describe('Direct access to protected pages (security)', () => {
  for (const path of adminPages) {
    test(`a signed-out visitor opening ${path} is sent to the staff sign-in`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL((url) => url.pathname === '/adminLogin');
      await expect(page.getByLabel('Staff email address')).toBeVisible();
      await expect(page.locator('.form-error')).toHaveCount(0);
    });
  }

  for (const path of guestPages) {
    test(`a signed-out visitor opening ${path} is sent to the guest sign-in`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL((url) => url.pathname === '/');
      await expect(page.getByLabel('Email')).toBeVisible();
    });
  }

  test('a signed-in guest cannot open the staff pages but stays signed in', async ({ page, request }) => {
    const guest = await registerGuestViaApi(request);
    await guestLogin(page, guest.email, guest.password);
    await expect(page).toHaveURL(/\/hotelBooking/);

    await page.goto('/dashboard');
    await expect(page).toHaveURL((url) => url.pathname === '/adminLogin');

    await page.goto('/history');
    await expect(page).toHaveURL(/\/history/);
  });

  test('a rejected token ends the session and returns to the sign-in page', async ({ page, request }) => {
    const guest = await registerGuestViaApi(request);
    await guestLogin(page, guest.email, guest.password);
    await expect(page).toHaveURL(/\/hotelBooking/);

    // Damage the token's signature: it still looks valid to the browser, but the API refuses it.
    await page.evaluate(() => {
      const token = sessionStorage.getItem('haven_token') ?? '';
      sessionStorage.setItem('haven_token', `${token.slice(0, -3)}xyz`);
    });
    await page.goto('/history');

    await expect(page).toHaveURL((url) => url.pathname === '/');
    expect(await page.evaluate(() => sessionStorage.getItem('haven_session'))).toBeNull();
  });
});
