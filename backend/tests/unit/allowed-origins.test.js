const assert = require('node:assert/strict');
const { test } = require('node:test');
const { corsOrigin, isAllowedOrigin } = require('../../middleware/allowed-origins');

test('the app on this computer and on private networks is allowed', () => {
  for (const origin of [
    'http://localhost:4200',
    'http://127.0.0.1:4200',
    'http://192.168.1.23:4200',
    'http://10.0.0.5:4200',
    'http://172.16.4.9:4200',
    'http://172.31.255.1:4200',
  ]) {
    assert.equal(isAllowedOrigin(origin), true, origin);
  }
});

test('public sites, other ports and lookalike addresses are refused', () => {
  for (const origin of [
    'http://evil.example.com:4200',
    'https://192.168.1.23:4200',
    'http://192.168.1.23:9999',
    'http://172.32.0.1:4200',
    'http://8.8.8.8:4200',
    'http://192.168.1.23:4200.evil.com',
    'http://localhost.evil.com:4200',
  ]) {
    assert.equal(isAllowedOrigin(origin), false, origin);
  }
});

test('requests without an Origin header are not blocked, and the cors callback gets the verdict', () => {
  assert.equal(isAllowedOrigin(undefined), true);
  corsOrigin('http://192.168.1.23:4200', (error, allowed) => {
    assert.equal(error, null);
    assert.equal(allowed, true);
  });
  corsOrigin('http://evil.example.com:4200', (error, allowed) => {
    assert.equal(allowed, false);
  });
});
