import { request } from '@playwright/test';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

/**
 * After the whole run, put every room created by the tests (numbers start with "E2E")
 * into Maintenance. Guests then never see test rooms in the room list, and any bookings
 * the tests made stay valid, because nothing is deleted.
 */
export default async function globalTeardown(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    return;
  }

  const api = await request.newContext();
  try {
    const login = await api.post(`${API_URL}/api/auth/login`, {
      data: { email, password, role: 'admin' },
    });
    if (!login.ok()) {
      console.warn('Teardown skipped: admin login failed.');
      return;
    }
    const { token } = await login.json();
    const headers = { authorization: `Bearer ${token}` };

    const list = await api.get(`${API_URL}/api/rooms/admin`, { headers });
    const rooms: Array<{ id: string; number: string; statusOverride: string }> = await list.json();

    const testRooms = rooms.filter(
      (room) => room.number.startsWith('E2E') && room.statusOverride !== 'Maintenance'
    );
    for (const room of testRooms) {
      await api.patch(`${API_URL}/api/rooms/${room.id}/status`, {
        headers,
        data: { status: 'Maintenance' },
      });
    }
    console.log(`Teardown: set ${testRooms.length} test room(s) to Maintenance.`);
  } finally {
    await api.dispose();
  }
}
