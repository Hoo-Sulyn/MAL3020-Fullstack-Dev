const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { setTimeout: sleep } = require('node:timers/promises');
const { test } = require('node:test');
const express = require('express');
const { Server } = require('socket.io');
const { io: connectSocket } = require('socket.io-client');
const createGracefulShutdown = require('../../services/graceful-shutdown');

// These tests use a real HTTP server and a real Socket.IO server, but no database:
// the database connection is replaced by a spy so we can see it is closed last.
async function startTestServer({ timeoutMs = 2000, drainDelayMs = 0 } = {}) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const mongoose = {
    disconnectCalls: 0,
    async disconnect() {
      this.disconnectCalls++;
    },
  };
  const shutdown = createGracefulShutdown({
    server,
    io,
    mongoose,
    timeoutMs,
    drainDelayMs,
    log: () => {},
  });

  app.use(shutdown.trackRequests);
  app.get('/health', (req, res) => {
    res.status(shutdown.isShuttingDown() ? 503 : 200).json({ shuttingDown: shutdown.isShuttingDown() });
  });
  app.get('/slow', async (req, res) => {
    await sleep(Number(req.query.ms) || 300);
    res.json({ completed: true });
  });
  app.get('/hang', () => {
    // Never answers: simulates a request that will not finish before the time limit.
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  return { url, server, io, mongoose, shutdown };
}

test('a request in progress finishes during shutdown, and new connections are refused', async () => {
  const { url, mongoose, shutdown } = await startTestServer();

  const inProgress = fetch(`${url}/slow?ms=300`).then((response) => response.json());
  await sleep(50);
  assert.equal(shutdown.inFlightCount(), 1);
  assert.equal(shutdown.isShuttingDown(), false);

  const shutdownDone = shutdown.run('test');
  assert.equal(shutdown.isShuttingDown(), true);

  await assert.rejects(fetch(`${url}/slow?ms=1`), 'a new request must not be accepted');
  assert.deepEqual(await inProgress, { completed: true });

  await shutdownDone;
  assert.equal(shutdown.inFlightCount(), 0);
  assert.equal(mongoose.disconnectCalls, 1, 'the database is closed after the requests finish');
});

test('shutdown gives up on a stuck request after the time limit', async () => {
  const { url, mongoose, shutdown } = await startTestServer({ timeoutMs: 200 });

  const stuck = fetch(`${url}/hang`).then(() => 'answered', () => 'connection closed');
  await sleep(50);

  const startedAt = Date.now();
  await shutdown.run('test');
  const elapsed = Date.now() - startedAt;

  assert.ok(elapsed >= 150, `waited for the time limit (${elapsed} ms)`);
  assert.ok(elapsed < 1500, `did not wait forever (${elapsed} ms)`);
  assert.equal(await stuck, 'connection closed');
  assert.equal(mongoose.disconnectCalls, 1);
});

test('connected Socket.IO clients are disconnected so they can reconnect elsewhere', async () => {
  const { url, shutdown } = await startTestServer();
  const client = connectSocket(url, { reconnection: false, transports: ['websocket'] });
  await once(client, 'connect');

  const disconnected = once(client, 'disconnect');
  await shutdown.run('test');
  await disconnected;

  assert.equal(client.connected, false);
  client.close();
});

test('running shutdown twice only shuts down once', async () => {
  const { mongoose, shutdown } = await startTestServer();

  const first = shutdown.run('SIGTERM');
  const second = shutdown.run('SIGINT');
  await Promise.all([first, second]);

  assert.equal(first, second);
  assert.equal(mongoose.disconnectCalls, 1);
});

test('health reports unavailable during the drain delay while requests are still served', async () => {
  const { url, shutdown } = await startTestServer({ drainDelayMs: 300 });

  assert.equal((await fetch(`${url}/health`)).status, 200);

  const shutdownDone = shutdown.run('test');
  await sleep(50);
  const during = await fetch(`${url}/health`);
  assert.equal(during.status, 503, 'the load balancer is told to stop sending traffic');

  await shutdownDone;
  await assert.rejects(fetch(`${url}/health`), 'the listener is closed after the delay');
});
