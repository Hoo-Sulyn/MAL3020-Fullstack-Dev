const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'unit-test-secret-that-is-long-enough';
const requireAuth = require('../../middleware/require-auth');

function createRequest(token) {
  return {
    get(header) {
      assert.equal(header, 'authorization');
      return token ? `Bearer ${token}` : undefined;
    },
  };
}

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('authentication middleware rejects a missing bearer token', () => {
  const response = createResponse();
  const next = () => assert.fail('next should not be called');

  requireAuth('guest')(createRequest(), response, next);

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.message, 'Authentication is required.');
});

test('authentication middleware rejects an invalid token', () => {
  const response = createResponse();
  const next = () => assert.fail('next should not be called');

  requireAuth('guest')(createRequest('not-a-valid-token'), response, next);

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.message, 'The authentication token is invalid or expired.');
});

test('authentication middleware rejects a token with the wrong role', () => {
  const token = jwt.sign({ sub: 'user-123', role: 'admin' }, process.env.JWT_SECRET);
  const response = createResponse();
  const next = () => assert.fail('next should not be called');

  requireAuth('guest')(createRequest(token), response, next);

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.message, 'You do not have permission to perform this action.');
});

test('authentication middleware attaches valid user identity and continues', () => {
  const token = jwt.sign({ sub: 'user-123', role: 'guest' }, process.env.JWT_SECRET);
  const request = createRequest(token);
  const response = createResponse();
  let nextCalled = false;

  requireAuth('guest')(request, response, () => {
    nextCalled = true;
  });

  assert.deepEqual(request.auth, { userId: 'user-123', role: 'guest' });
  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, null);
});
