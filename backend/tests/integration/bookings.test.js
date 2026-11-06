require('dotenv').config();

const assert = require('node:assert/strict');
const http = require('node:http');
const { after, before, test } = require('node:test');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { io: connectSocket } = require('socket.io-client');
const Booking = require('../../models/booking');
const Room = require('../../models/room');
const User = require('../../models/user');
const bookingRoutes = require('../../routes/bookings');
const roomRoutes = require('../../routes/rooms');
const createRealtimeServer = require('../../services/realtime-server');
const { getHotelDateValue } = require('../../utils/date');

const baseMongoUri = process.env.MONGO_TEST_URI || process.env.MONGO_URI;
const isLocalMongoUri = (() => {
  if (!baseMongoUri) {
    return false;
  }
  try {
    const hostname = new URL(baseMongoUri).hostname;
    return hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname === '::1'
      || hostname === '[::1]';
  } catch {
    return false;
  }
})();
const testMongoUri = isLocalMongoUri
  ? (() => {
      const url = new URL(baseMongoUri);
      url.pathname = `/mal3020_booking_test_${process.pid}`;
      return url.toString();
    })()
  : null;

let server;
let io;
let baseUrl;
let firstGuest;
let secondGuest;
let admin;
let roomSequence = 0;

function dateOffset(days) {
  const date = new Date(`${getHotelDateValue()}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function tokenFor(user, role = user.role) {
  return jwt.sign(
    { role },
    process.env.JWT_SECRET,
    { subject: user._id.toString(), expiresIn: '5m' }
  );
}

async function request(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function createRoom(overrides = {}) {
  roomSequence++;
  return Room.create({
    number: `T${process.pid}-${roomSequence}`,
    type: 'Superior King',
    floor: 1,
    description: 'Integration test room',
    amenities: 'Wi-Fi',
    capacity: 2,
    nightlyRate: 200,
    statusOverride: 'Automatic',
    ...overrides,
  });
}

function roomPayload(room, overrides = {}) {
  return {
    number: room.number,
    type: room.type,
    floor: room.floor,
    description: room.description,
    amenities: room.amenities,
    capacity: room.capacity,
    nightlyRate: room.nightlyRate,
    status: room.statusOverride,
    ...overrides,
  };
}

async function submitBooking(guest, room, checkIn, checkOut) {
  return request('/api/bookings', {
    method: 'POST',
    token: tokenFor(guest),
    body: {
      roomId: room._id.toString(),
      checkIn,
      checkOut,
      adults: 1,
      children: 0,
      travelingWithPets: false,
    },
  });
}

function connectAuthenticatedSocket(token) {
  const socket = connectSocket(baseUrl, {
    transports: ['websocket'],
    auth: { token },
    reconnection: false,
  });
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Socket connection timed out.'));
    }, 3000);
    socket.once('connect', () => {
      clearTimeout(timeout);
      resolve(socket);
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timeout);
      socket.disconnect();
      reject(error);
    });
  });
}

function waitForBookingChange(socket) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Booking event timed out.')), 3000);
    socket.once('booking:changed', (event) => {
      clearTimeout(timeout);
      resolve(event);
    });
  });
}

before(async (context) => {
  if (!testMongoUri) {
    context.skip('Set MONGO_TEST_URI or use a local MONGO_URI to run backend integration tests.');
    return;
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set to at least 32 characters for integration tests.');
  }

  await mongoose.connect(testMongoUri);

  const app = express();
  app.use(express.json());
  app.set('io', { to: () => ({ emit: () => {} }) });
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/rooms', roomRoutes);
  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }
    return res.status(error.status || 500).json({ message: error.message });
  });

  server = http.createServer(app);
  io = createRealtimeServer(server);
  app.set('io', io);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  [firstGuest, secondGuest, admin] = await Promise.all([
    User.create({
      firstName: 'First',
      lastName: 'Guest',
      email: `first-${process.pid}@example.test`,
      phone: '+60123456781',
      password: 'test-password-hash',
      role: 'guest',
    }),
    User.create({
      firstName: 'Second',
      lastName: 'Guest',
      email: `second-${process.pid}@example.test`,
      phone: '+60123456782',
      password: 'test-password-hash',
      role: 'guest',
    }),
    User.create({
      firstName: 'Test',
      lastName: 'Admin',
      email: `admin-${process.pid}@example.test`,
      phone: '+60123456783',
      password: 'test-password-hash',
      role: 'admin',
    }),
  ]);
});

after(async () => {
  if (io) {
    await new Promise((resolve) => io.close(resolve));
  } else if (server?.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test('requires authentication and enforces booking ownership and roles', async (context) => {
  if (!testMongoUri) {
    context.skip('A local test MongoDB is required.');
    return;
  }

  assert.equal((await request('/api/bookings/mine')).status, 401);
  assert.equal((await request('/api/bookings/admin')).status, 401);
  assert.equal((await request('/api/bookings/admin', {
    token: tokenFor(firstGuest),
  })).status, 403);
  assert.equal((await request('/api/rooms', {
    method: 'POST',
    token: tokenFor(firstGuest),
    body: {},
  })).status, 403);

  const room = await createRoom();
  const bookingResponse = await submitBooking(firstGuest, room, dateOffset(20), dateOffset(22));
  assert.equal(bookingResponse.status, 201);
  const booking = await bookingResponse.json();

  assert.equal((await request(`/api/bookings/${booking.id}/cancel`, {
    method: 'PATCH',
    token: tokenFor(secondGuest),
  })).status, 404);
  assert.equal((await request(`/api/bookings/${booking.id}/cancel`, {
    method: 'PATCH',
    token: tokenFor(firstGuest),
  })).status, 200);

  const replacementBooking = await submitBooking(secondGuest, room, dateOffset(20), dateOffset(22));
  assert.equal(replacementBooking.status, 201);
  const firstGuestBookings = await request('/api/bookings/mine', {
    token: tokenFor(firstGuest),
  });
  assert.deepEqual((await firstGuestBookings.json()).map((item) => item.id), [booking.id]);
});

test('rejects invalid booking dates and allows back-to-back stays', async (context) => {
  if (!testMongoUri) {
    context.skip('A local test MongoDB is required.');
    return;
  }

  const room = await createRoom();
  assert.equal((await submitBooking(firstGuest, room, '2026-02-30', '2026-03-02')).status, 400);
  assert.equal((await submitBooking(firstGuest, room, dateOffset(10), dateOffset(10))).status, 400);

  const firstStay = await submitBooking(firstGuest, room, dateOffset(10), dateOffset(12));
  const nextStay = await submitBooking(secondGuest, room, dateOffset(12), dateOffset(14));
  assert.equal(firstStay.status, 201);
  assert.equal(nextStay.status, 201);
});

test('allows guests to edit eligible bookings while enforcing ownership and availability', async (context) => {
  if (!testMongoUri) {
    context.skip('A local test MongoDB is required.');
    return;
  }

  const room = await createRoom();
  const originalBookingResponse = await submitBooking(
    firstGuest,
    room,
    dateOffset(20),
    dateOffset(22)
  );
  assert.equal(originalBookingResponse.status, 201);
  const originalBooking = await originalBookingResponse.json();
  const occupiedDatesResponse = await submitBooking(
    secondGuest,
    room,
    dateOffset(25),
    dateOffset(27)
  );
  assert.equal(occupiedDatesResponse.status, 201);

  const bookingUrl = `/api/bookings/${originalBooking.id}`;
  const editPayload = {
    checkIn: dateOffset(22),
    checkOut: dateOffset(24),
    adults: 2,
    children: 0,
    travelingWithPets: true,
  };
  assert.equal((await request(bookingUrl, {
    method: 'PUT',
    token: tokenFor(secondGuest),
    body: editPayload,
  })).status, 404);
  assert.equal((await request(bookingUrl, {
    method: 'PUT',
    token: tokenFor(admin),
    body: editPayload,
  })).status, 403);
  assert.equal((await request(bookingUrl, {
    method: 'PUT',
    token: tokenFor(firstGuest),
    body: { ...editPayload, checkIn: '2026-02-31' },
  })).status, 400);
  assert.equal((await request(bookingUrl, {
    method: 'PUT',
    token: tokenFor(firstGuest),
    body: { ...editPayload, checkIn: dateOffset(25), checkOut: dateOffset(26) },
  })).status, 409);

  const updateResponse = await request(bookingUrl, {
    method: 'PUT',
    token: tokenFor(firstGuest),
    body: editPayload,
  });
  assert.equal(updateResponse.status, 200);
  const updatedBooking = await updateResponse.json();
  assert.equal(updatedBooking.id, originalBooking.id);
  assert.equal(updatedBooking.checkIn, editPayload.checkIn);
  assert.equal(updatedBooking.checkOut, editPayload.checkOut);
  assert.equal(updatedBooking.adults, 2);
  assert.equal(updatedBooking.travelingWithPets, true);
  assert.equal(updatedBooking.total, 400);

  const sameDayRoom = await createRoom();
  const sameDayBookingResponse = await submitBooking(
    firstGuest,
    sameDayRoom,
    getHotelDateValue(),
    dateOffset(1)
  );
  assert.equal(sameDayBookingResponse.status, 201);
  const sameDayBooking = await sameDayBookingResponse.json();
  assert.equal((await request(`/api/bookings/${sameDayBooking.id}`, {
    method: 'PUT',
    token: tokenFor(firstGuest),
    body: editPayload,
  })).status, 404);
});

test('enforces valid booking status transitions', async (context) => {
  if (!testMongoUri) {
    context.skip('A local test MongoDB is required.');
    return;
  }

  const room = await createRoom();
  const bookingResponse = await submitBooking(firstGuest, room, getHotelDateValue(), dateOffset(1));
  assert.equal(bookingResponse.status, 201);
  const booking = await bookingResponse.json();
  const statusUrl = `/api/bookings/${booking.id}/status`;
  const adminToken = tokenFor(admin);

  assert.equal((await request(statusUrl, {
    method: 'PATCH',
    token: tokenFor(firstGuest),
    body: { status: 'Checked in' },
  })).status, 403);
  assert.equal((await request(statusUrl, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'Checked out' },
  })).status, 409);

  const checkInResponse = await request(statusUrl, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'Checked in' },
  });
  assert.equal(checkInResponse.status, 200);
  assert.equal((await checkInResponse.json()).status, 'Checked in');

  assert.equal((await request(`/api/bookings/${booking.id}`, {
    method: 'PUT',
    token: tokenFor(firstGuest),
    body: {
      checkIn: getHotelDateValue(),
      checkOut: dateOffset(1),
      adults: 1,
      children: 0,
      travelingWithPets: false,
    },
  })).status, 404);

  const checkOutResponse = await request(statusUrl, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'Checked out' },
  });
  assert.equal(checkOutResponse.status, 200);
  assert.equal((await checkOutResponse.json()).status, 'Checked out');

  assert.equal((await request(statusUrl, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'Checked in' },
  })).status, 409);
});

test('supports admin room create, read, update, status change, and delete', async (context) => {
  if (!testMongoUri) {
    context.skip('A local test MongoDB is required.');
    return;
  }

  const adminToken = tokenFor(admin);
  const roomNumber = `CRUD-${process.pid}-${++roomSequence}`;
  const payload = {
    number: roomNumber,
    type: 'Superior King',
    floor: 2,
    description: 'Room CRUD test',
    amenities: 'Wi-Fi',
    capacity: 2,
    nightlyRate: 250,
    status: 'Automatic',
  };
  assert.equal((await request('/api/rooms', {
    method: 'POST',
    token: adminToken,
    body: { ...payload, capacity: 0 },
  })).status, 400);
  const createResponse = await request('/api/rooms', {
    method: 'POST',
    token: adminToken,
    body: payload,
  });
  assert.equal(createResponse.status, 201);
  const createdRoom = await createResponse.json();

  assert.equal((await request(`/api/rooms/${createdRoom.id}`)).status, 200);
  assert.equal((await request(`/api/rooms/admin`, {
    token: tokenFor(firstGuest),
  })).status, 403);

  const updateResponse = await request(`/api/rooms/${createdRoom.id}`, {
    method: 'PUT',
    token: adminToken,
    body: roomPayload(createdRoom, {
      description: 'Updated room description',
      nightlyRate: 300,
    }),
  });
  assert.equal(updateResponse.status, 200);
  assert.equal((await updateResponse.json()).nightlyRate, 300);

  const statusResponse = await request(`/api/rooms/${createdRoom.id}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'Maintenance' },
  });
  assert.equal(statusResponse.status, 200);
  assert.equal((await statusResponse.json()).status, 'Maintenance');

  const duplicateResponse = await request('/api/rooms', {
    method: 'POST',
    token: adminToken,
    body: payload,
  });
  assert.equal(duplicateResponse.status, 409);

  assert.equal((await request(`/api/rooms/${createdRoom.id}`, {
    method: 'DELETE',
    token: adminToken,
  })).status, 204);
  assert.equal((await request(`/api/rooms/${createdRoom.id}`)).status, 404);
});

test('rejects invalid socket tokens and sends booking events only to the owner and admins', async (context) => {
  if (!testMongoUri) {
    context.skip('A local test MongoDB is required.');
    return;
  }

  await assert.rejects(connectAuthenticatedSocket('invalid-token'));

  const ownerSocket = await connectAuthenticatedSocket(tokenFor(firstGuest));
  const unrelatedGuestSocket = await connectAuthenticatedSocket(tokenFor(secondGuest));
  const adminSocket = await connectAuthenticatedSocket(tokenFor(admin));
  try {
    const unrelatedEvents = [];
    unrelatedGuestSocket.on('booking:changed', (event) => unrelatedEvents.push(event));
    const ownerEvent = waitForBookingChange(ownerSocket);
    const adminEvent = waitForBookingChange(adminSocket);
    const room = await createRoom();
    const response = await submitBooking(firstGuest, room, dateOffset(30), dateOffset(32));
    assert.equal(response.status, 201);
    const booking = await response.json();

    assert.deepEqual(await ownerEvent, { action: 'created', id: booking.id });
    assert.deepEqual(await adminEvent, { action: 'created', id: booking.id });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.deepEqual(unrelatedEvents, []);
  } finally {
    ownerSocket.disconnect();
    unrelatedGuestSocket.disconnect();
    adminSocket.disconnect();
  }
});

test('serializes competing overlapping bookings while allowing later dates', async (context) => {
  if (!testMongoUri) {
    context.skip('A local test MongoDB is required.');
    return;
  }

  const room = await createRoom();
  const checkIn = dateOffset(40);
  const checkOut = dateOffset(42);
  const results = await Promise.all([
    submitBooking(firstGuest, room, checkIn, checkOut),
    submitBooking(secondGuest, room, checkIn, checkOut),
  ]);

  assert.deepEqual(results.map((response) => response.status).sort(), [201, 409]);
  assert.equal(await Booking.countDocuments({ roomId: room._id }), 1);

  const laterBooking = await submitBooking(secondGuest, room, dateOffset(43), dateOffset(45));
  assert.equal(laterBooking.status, 201);
  assert.equal(await Booking.countDocuments({ roomId: room._id }), 2);
});
