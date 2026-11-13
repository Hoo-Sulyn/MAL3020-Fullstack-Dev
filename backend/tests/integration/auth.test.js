require('dotenv').config();

const assert = require('node:assert/strict');
const http = require('node:http');
const { after, before, test } = require('node:test');
const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../../models/user');
const authRoutes = require('../../routes/auth');
const profileRoutes = require('../../routes/profile');

// Same safety rule as the booking tests: only run against a local MongoDB,
// and always use a throwaway database named after this process.
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
      url.pathname = `/mal3020_auth_test_${process.pid}`;
      return url.toString();
    })()
  : null;

let server;
let baseUrl;
let emailSequence = 0;

function uniqueEmail(prefix = 'user') {
  emailSequence++;
  return `${prefix}-${process.pid}-${emailSequence}@example.test`;
}

function registrationBody(overrides = {}) {
  return {
    firstName: 'Test',
    lastName: 'Guest',
    email: uniqueEmail('guest'),
    phone: '+60123456789',
    password: 'correct-horse-battery',
    ...overrides,
  };
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

async function registerGuest(overrides = {}) {
  const body = registrationBody(overrides);
  const response = await request('/api/auth/register', { method: 'POST', body });
  assert.equal(response.status, 201);
  return { body, user: (await response.json()).user };
}

async function loginAs(email, password, role = 'guest') {
  return request('/api/auth/login', {
    method: 'POST',
    body: { email, password, role },
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
  await User.init();

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/profile', profileRoutes);
  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }
    return res.status(error.status || 500).json({ message: error.message });
  });

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test('registration creates a guest with a hashed password and never exposes it', async () => {
  const body = registrationBody({
    email: `  ${uniqueEmail('Mixed')}  `.toUpperCase(),
    role: 'admin',
  });
  const response = await request('/api/auth/register', { method: 'POST', body });
  const result = await response.json();

  assert.equal(response.status, 201);
  assert.equal(result.user.role, 'guest', 'a client must not be able to choose its own role');
  assert.equal(result.user.email, body.email.trim().toLowerCase());
  assert.equal(result.user.password, undefined);

  const stored = await User.findById(result.user.id).select('+password');
  assert.notEqual(stored.password, body.password);
  assert.equal(await bcrypt.compare(body.password, stored.password), true);
});

test('registration rejects invalid details and duplicate emails', async () => {
  const invalidBodies = [
    registrationBody({ password: 'short' }),
    registrationBody({ email: 'not-an-email' }),
    registrationBody({ phone: 'abc' }),
    registrationBody({ firstName: 'A' }),
    registrationBody({ password: 'x'.repeat(73) }),
    registrationBody({ email: { $ne: '' } }),
  ];
  for (const body of invalidBodies) {
    const response = await request('/api/auth/register', { method: 'POST', body });
    assert.equal(response.status, 400);
  }

  const { body } = await registerGuest();
  const duplicate = await request('/api/auth/register', {
    method: 'POST',
    body: registrationBody({ email: body.email.toUpperCase() }),
  });
  assert.equal(duplicate.status, 409);
});

test('login issues a token only for the correct password and account type', async () => {
  const { body, user } = await registerGuest();

  const success = await loginAs(body.email, body.password);
  const result = await success.json();
  assert.equal(success.status, 200);
  assert.equal(result.user.id, user.id);
  assert.equal(result.user.password, undefined);

  const payload = jwt.verify(result.token, process.env.JWT_SECRET);
  assert.equal(payload.sub, user.id);
  assert.equal(payload.role, 'guest');
  assert.ok(payload.exp > payload.iat, 'the token must expire');

  assert.equal((await loginAs(body.email, 'wrong-password')).status, 401);
  assert.equal((await loginAs(body.email, body.password, 'admin')).status, 401);
  assert.equal((await loginAs(uniqueEmail('nobody'), body.password)).status, 401);
  assert.equal(
    (await request('/api/auth/login', {
      method: 'POST',
      body: { email: body.email, password: body.password, role: 'superuser' },
    })).status,
    400
  );
});

test('login rejects a NoSQL injection attempt', async () => {
  await registerGuest();
  const response = await request('/api/auth/login', {
    method: 'POST',
    body: { email: { $ne: '' }, password: { $ne: '' }, role: 'guest' },
  });
  assert.equal(response.status, 400);
});

test('profile routes require a guest token and reject admins and bad tokens', async () => {
  const { body, user } = await registerGuest();
  const guestToken = (await (await loginAs(body.email, body.password)).json()).token;
  const adminToken = jwt.sign(
    { role: 'admin' },
    process.env.JWT_SECRET,
    { subject: user.id, expiresIn: '5m' }
  );
  const expiredToken = jwt.sign(
    { role: 'guest' },
    process.env.JWT_SECRET,
    { subject: user.id, expiresIn: -10 }
  );
  const forgedToken = jwt.sign(
    { role: 'guest' },
    'a-different-secret-that-is-at-least-32-chars',
    { subject: user.id, expiresIn: '5m' }
  );

  assert.equal((await request('/api/profile')).status, 401);
  assert.equal((await request('/api/profile', { token: expiredToken })).status, 401);
  assert.equal((await request('/api/profile', { token: forgedToken })).status, 401);
  assert.equal((await request('/api/profile', { token: adminToken })).status, 403);

  const profile = await request('/api/profile', { token: guestToken });
  assert.equal(profile.status, 200);
  assert.equal((await profile.json()).email, body.email.toLowerCase());
});

test('guests can update their own profile but not take another guest\'s email', async () => {
  const first = await registerGuest();
  const second = await registerGuest();
  const token = (await (await loginAs(first.body.email, first.body.password)).json()).token;

  const update = await request('/api/profile', {
    method: 'PUT',
    token,
    body: {
      firstName: 'Renamed',
      lastName: first.body.lastName,
      email: first.body.email,
      phone: '+60198765432',
    },
  });
  assert.equal(update.status, 200);
  assert.equal((await update.json()).firstName, 'Renamed');

  const clash = await request('/api/profile', {
    method: 'PUT',
    token,
    body: {
      firstName: 'Renamed',
      lastName: first.body.lastName,
      email: second.body.email,
      phone: '+60198765432',
    },
  });
  assert.equal(clash.status, 409);
});

test('changing a password requires the current password and takes effect', async () => {
  const { body } = await registerGuest();
  const token = (await (await loginAs(body.email, body.password)).json()).token;

  const wrongCurrent = await request('/api/profile/password', {
    method: 'PUT',
    token,
    body: { currentPassword: 'not-my-password', newPassword: 'a-brand-new-password' },
  });
  assert.equal(wrongCurrent.status, 400);

  const tooShort = await request('/api/profile/password', {
    method: 'PUT',
    token,
    body: { currentPassword: body.password, newPassword: 'short' },
  });
  assert.equal(tooShort.status, 400);

  const changed = await request('/api/profile/password', {
    method: 'PUT',
    token,
    body: { currentPassword: body.password, newPassword: 'a-brand-new-password' },
  });
  assert.equal(changed.status, 204);
  assert.equal((await loginAs(body.email, body.password)).status, 401);
  assert.equal((await loginAs(body.email, 'a-brand-new-password')).status, 200);
});

test('deleting an account removes only the signed-in guest', async () => {
  const first = await registerGuest();
  const second = await registerGuest();
  const token = (await (await loginAs(first.body.email, first.body.password)).json()).token;

  const deleted = await request('/api/profile/account', { method: 'DELETE', token });
  assert.equal(deleted.status, 204);
  assert.equal(await User.exists({ _id: first.user.id }), null);
  assert.ok(await User.exists({ _id: second.user.id }));
  assert.equal((await loginAs(first.body.email, first.body.password)).status, 401);
});