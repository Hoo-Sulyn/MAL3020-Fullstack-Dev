/**
 * Graceful shutdown for a rolling deployment.
 *
 * When a new version of the backend replaces this one, the old container is sent SIGTERM.
 * Stopping at once would cut off requests that are still being processed (for example a
 * booking that has been checked but not yet saved). Instead this module:
 *   1. marks the server as shutting down, so /health reports 503 and a load balancer
 *      stops sending it new traffic, then keeps serving for a short drain delay so that
 *      requests already on their way (still queued in the network) are not refused;
 *   2. stops accepting new connections;
 *   3. waits for requests already in progress to finish (up to a time limit);
 *   4. disconnects Socket.IO clients, so they reconnect to the new version;
 *   5. closes the database connection.
 */
function createGracefulShutdown({
  server,
  io,
  mongoose,
  timeoutMs = 10000,
  drainDelayMs = 0,
  log = console.log,
}) {
  let inFlight = 0;
  let shuttingDown = false;
  let shutdownPromise = null;
  let drainWaiters = [];

  function notifyIfDrained() {
    if (inFlight === 0) {
      drainWaiters.forEach((resolve) => resolve());
      drainWaiters = [];
    }
  }

  function waitForDrain() {
    if (inFlight === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => drainWaiters.push(resolve));
  }

  /** Express middleware: counts requests in progress. */
  function trackRequests(req, res, next) {
    inFlight++;
    let finished = false;
    const finish = () => {
      if (!finished) {
        finished = true;
        inFlight--;
        notifyIfDrained();
      }
    };
    res.on('finish', finish);
    res.on('close', finish);
    if (shuttingDown) {
      // Ask the client to open its next request on a new connection (to the new version).
      res.setHeader('Connection', 'close');
    }
    next();
  }

  function run(signal = 'shutdown') {
    if (shutdownPromise) {
      return shutdownPromise;
    }
    shuttingDown = true;

    shutdownPromise = (async () => {
      log(`${signal} received: reporting unavailable, finishing ${inFlight} request(s) in progress.`);

      if (drainDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, drainDelayMs));
      }

      const serverClosed = new Promise((resolve) => server.once('close', resolve));
      server.close();
      server.closeIdleConnections?.();

      const timeout = new Promise((resolve) => {
        setTimeout(() => resolve('timeout'), timeoutMs).unref();
      });
      const outcome = await Promise.race([waitForDrain().then(() => 'drained'), timeout]);
      if (outcome === 'timeout') {
        log(`Time limit of ${timeoutMs} ms reached: closing ${inFlight} remaining request(s).`);
        server.closeAllConnections?.();
      }

      await io.close();
      server.closeAllConnections?.();
      await Promise.race([serverClosed, timeout]);

      await mongoose.disconnect();
      log('Shutdown complete.');
    })();

    return shutdownPromise;
  }

  return {
    trackRequests,
    run,
    isShuttingDown: () => shuttingDown,
    inFlightCount: () => inFlight,
  };
}

module.exports = createGracefulShutdown;
