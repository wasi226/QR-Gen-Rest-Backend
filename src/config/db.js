import mongoose from 'mongoose';
import { env } from './env.js';

export const connectDb = async () => {
  if (!env.mongoUri) {
    throw new Error('MONGO_URI is missing in environment variables.');
  }

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });

  // Helpful boot log for production observability.
  console.log('MongoDB connected successfully');
};
