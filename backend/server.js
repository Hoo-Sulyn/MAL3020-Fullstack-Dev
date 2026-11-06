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

const app = express();
const server = http.createServer(app);
const io = createRealtimeServer(server);
app.set('io', io);
app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json());

app.get('/', (req, res) => res.send('API is running'));
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