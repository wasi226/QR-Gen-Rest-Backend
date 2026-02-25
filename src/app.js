import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import itemRoutes from './routes/itemRoutes.js';
import offerRoutes from './routes/offerRoutes.js';
import buildOrderRoutes from './routes/orderRoutes.js';

export const createApp = (io) => {
  const app = express();

  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin: env.frontendUrl,
      credentials: true,
    })
  );

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 1000,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, message: 'Server is healthy' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/items', itemRoutes);
  app.use('/api/offers', offerRoutes);
  app.use('/api/orders', buildOrderRoutes(io));

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
