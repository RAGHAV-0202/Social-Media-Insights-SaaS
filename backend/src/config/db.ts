import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoUri = process.env.MONGO_URI;
let connectionPromise: Promise<typeof mongoose> | null = null;

export const connectDB = async () => {
  if (!mongoUri) {
    throw new Error('MONGO_URI is not set. Configure it in the Vercel project environment.');
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });

  try {
    await connectionPromise;
    console.log('MongoDB connected successfully');
    return mongoose;
  } catch (error) {
    connectionPromise = null;
    console.error('MongoDB connection failed:', error);
    throw error;
  }
};
