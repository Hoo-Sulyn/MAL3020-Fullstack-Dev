require('dotenv').config();
const http = require('node:http');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const roomRoutes = require('./routes/rooms');
const bookingRoutes = require('./routes/bookings');
const createRealtimeServer = require('./services/realtime-server');
const createGracefulShutdown = require('./services/graceful-shutdown');

const app = express();
const server = http.createServer(app);
const io = createRealtimeServer(server);
app.set('io', io);
const shutdown = createGracefulShutdown({
  server,
  io,
  mongoose,
  timeoutMs: Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10000,
  drainDelayMs: Number(process.env.SHUTDOWN_DELAY_MS ?? 1000),
});
app.use(shutdown.trackRequests);
app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json());

app.get('/', (req, res) => res.send('API is running'));
// Readiness check used by Docker and any load balancer. It reports 503 while the database
// is unavailable or while this instance is shutting down, so traffic moves to a healthy one.
app.get('/health', (req, res) => {
  if (shutdown.isShuttingDown()) {
    return res.status(503).json({ status: 'shutting-down' });
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ status: 'unavailable', database: 'disconnected' });
  }
  return res.json({ status: 'ok', database: 'connected' });
});
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/bookings', bookingRoutes);
app.use((req, res) => res.status(404).json({ message: 'The requested API endpoint was not found.' }));
app.use((error, req, res, next) => {
  console.error('Request failed:', error.message);
  if (res.headersSent) {
    return next(error);
  }
  return res.status(error.status || 500).json({
    message: error.status ? error.message : 'An unexpected server error occurred.',
  });
});

async function startServer() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required in backend/.env');
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET is required and must be at least 32 characters long');
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');

  const port = process.env.PORT || 3000;
  server.listen(port, () => console.log(`Server on port ${port}`));
}

startServer().catch((error) => {
  console.error('Unable to start server:', error.message);
  process.exitCode = 1;
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    shutdown
      .run(signal)
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('Shutdown failed:', error.message);
        process.exit(1);
      });
  });
}
