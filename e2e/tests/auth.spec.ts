import { expect, test } from '@playwright/test';
import {
  ADMIN_EMAIL,
  GUEST_PASSWORD,
  adminLogin,
  guestLogin,
  newGuest,
  registerGuestViaApi,
} from './helpers';

test.describe('Registration and login (security)', () => {
  test('a new guest can register through the form and then sign in', async ({ page }) => {
    const guest = newGuest();

    await page.goto('/guestRegister');
    await page.getByLabel('First Name').fill(guest.firstName);
    await page.getByLabel('Last Name').fill(guest.lastName);
    await page.getByLabel('Email').fill(guest.email);
    await page.getByLabel('Phone Number').fill('+60123456789');
    await page.getByLabel('Password', { exact: true }).fill(guest.password);
    await page.getByLabel('Confirm Password').fill(guest.password);
    await page.getByRole('button', { name: 'Create guest account' }).click();

    await expect(page.getByText('Account created successfully')).toBeVisible();

    // The app sends the new guest to the sign-in page, then into the booking page.
    await expect(page).toHaveURL(/\/$/);
    await guestLogin(page, guest.email, guest.password);
    await expect(page).toHaveURL(/\/hotelBooking/);
  });

  test('a wrong password is rejected with an error message', async ({ page, request }) => {
    const guest = await registerGuestViaApi(request);

    await guestLogin(page, guest.email, `${GUEST_PASSWORD}-wrong`);

    await expect(page.locator('.form-error')).toContainText('Invalid email or password');
    await expect(page).not.toHaveURL(/hotelBooking/);
  });

  test('a guest account cannot sign in to the staff workspace', async ({ page, request }) => {
    const guest = await registerGuestViaApi(request);

    await page.goto('/adminLogin');
    await page.getByLabel('Staff email address').fill(guest.email);
    await page.getByLabel('Password', { exact: true }).fill(guest.password);
    await page.getByRole('button', { name: 'Sign in to staff workspace' }).click();

    await expect(page.locator('.form-error')).toBeVisible();
    await expect(page).not.toHaveURL(/dashboard/);
  });

  test('the admin can sign in and reaches the dashboard', async ({ page }) => {
    test.skip(!ADMIN_EMAIL, 'Set ADMIN_EMAIL and ADMIN_PASSWORD to run the admin tests.');

    await adminLogin(page);

    await expect(page).toHaveURL(/\/dashboard/);
  });
});
