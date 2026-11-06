const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

function createRealtimeServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: 'http://localhost:4200' },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string') {
      return next(new Error('Authentication is required.'));
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (
        typeof payload !== 'object' ||
        !payload.sub ||
        !['admin', 'guest'].includes(payload.role)
      ) {
        return next(new Error('The authentication token is invalid.'));
      }

      socket.data.auth = { userId: payload.sub, role: payload.role };
      return next();
    } catch {
      return next(new Error('The authentication token is invalid or expired.'));
    }
  });

  io.on('connection', (socket) => {
    if (socket.data.auth.role === 'admin') {
      socket.join('admins');
    } else {
      socket.join(`guest:${socket.data.auth.userId}`);
    }
  });

  return io;
}

module.exports = createRealtimeServer;
