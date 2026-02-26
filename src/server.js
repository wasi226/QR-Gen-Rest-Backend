import http from 'http';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { Order } from './models/Order.js';
import { seedDefaultUsers } from './utils/seedDefaultUsers.js';

const bootstrap = async () => {
  await connectDb();
  await seedDefaultUsers();
  const allowedOrigins = new Set(env.frontendUrls);

  // Create HTTP server first
  const httpServer = http.createServer();

  // Attach Socket.IO to the HTTP server BEFORE Express
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        const isAllowed =
          allowedOrigins.has(origin) ||
          origin.endsWith('.vercel.app') ||
          origin.includes('.vercel.app:');

        if (isAllowed) {
          callback(null, true);
          return;
        }

        callback(new Error(`Socket CORS blocked for origin: ${origin}`));
      },
      methods: ['GET', 'POST', 'PATCH'],
    },
  });

  // Create Express app with Socket.IO instance
  const app = createApp(io);

  // Attach Express app to the HTTP server
  // Express will handle non-Socket.IO requests
  httpServer.on('request', (req, res) => {
    // Let Socket.IO handle its own paths
    if (!req.url.startsWith('/socket.io')) {
      app(req, res);
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(env.port, () => {
    console.log(`Backend server running on port ${env.port}`);
  });

  // Cleanup job: Delete orders older than 48 hours every hour
  setInterval(async () => {
    try {
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const result = await Order.deleteMany({ createdAt: { $lt: fortyEightHoursAgo } });
      if (result.deletedCount > 0) {
        console.log(`Cleanup job: Deleted ${result.deletedCount} old orders`);
      }
    } catch (error) {
      console.error('Cleanup job failed:', error);
    }
  }, 60 * 60 * 1000); // Run every hour
};

bootstrap().catch((error) => {
  console.error('Server bootstrap failed:', error);
  process.exit(1);
});