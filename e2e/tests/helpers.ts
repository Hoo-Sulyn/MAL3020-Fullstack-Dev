import { APIRequestContext, Page, expect } from '@playwright/test';

export const API_URL = process.env.API_URL ?? 'http://localhost:3000';
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
export const GUEST_PASSWORD = 'correct-horse-battery';

export interface GuestAccount {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  password: string;
}

let counter = 0;

/** A short value that is different on every call, so tests never collide. */
export function unique(prefix: string): string {
  counter++;
  return `${prefix}${Date.now().toString(36)}${counter}`;
}

/** A date (YYYY-MM-DD) a number of days from today. Far-future dates avoid timezone edge cases. */
export function futureDate(daysAhead: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

export function newGuest(): GuestAccount {
  const firstName = 'Pat';
  const lastName = unique('Tester');
  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    email: `${unique('guest')}@example.test`,
    password: GUEST_PASSWORD,
  };
}

// ---------- Setup through the API (fast, keeps the UI tests focused) ----------

export async function adminToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${API_URL}/api/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: 'admin' },
  });
  expect(
    response.ok(),
    'Admin login via the API failed. Set ADMIN_EMAIL and ADMIN_PASSWORD and run the seed:admin script first.'
  ).toBeTruthy();
  return (await response.json()).token;
}

export async function createRoom(request: APIRequestContext, token: string): Promise<string> {
  const number = unique('E2E');
  const response = await request.post(`${API_URL}/api/rooms`, {
    headers: { authorization: `Bearer ${token}` },
    data: {
      number,
      type: 'Superior King',
      floor: 1,
      description: 'End-to-end test room',
      amenities: 'Wi-Fi',
      capacity: 2,
      nightlyRate: 250,
      status: 'Automatic',
    },
  });
  expect(response.status(), 'creating a test room through the API').toBe(201);
  return number;
}

export async function registerGuestViaApi(request: APIRequestContext): Promise<GuestAccount> {
  const guest = newGuest();
  const response = await request.post(`${API_URL}/api/auth/register`, {
    data: {
      firstName: guest.firstName,
      lastName: guest.lastName,
      email: guest.email,
      phone: '+60123456789',
      password: guest.password,
    },
  });
  expect(response.status(), 'registering a test guest through the API').toBe(201);
  return guest;
}

// ---------- Steps a real user performs in the browser ----------

export async function guestLogin(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function adminLogin(page: Page): Promise<void> {
  await page.goto('/adminLogin');
  await page.getByLabel('Staff email address').fill(ADMIN_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in to staff workspace' }).click();
}

/** Search for a room, open it, and confirm the booking, exactly as a guest would. */
export async function bookRoomThroughUi(
  page: Page,
  roomNumber: string,
  checkIn: string,
  checkOut: string
): Promise<void> {
  await page.getByLabel('Check-in').fill(checkIn);
  await page.getByLabel('Check-out').fill(checkOut);
  await page.locator('.search-button').click();

  const card = page.locator('app-room-card').filter({ hasText: `Room ${roomNumber}` });
  await card.getByRole('button', { name: 'View details' }).click();
  await page.getByRole('button', { name: 'Continue to booking' }).click();
  await page.locator('#confirm-booking-btn').click();
}
