import mongoose from 'mongoose';
import { createClient } from 'redis';
import env from './env';
import logger from './logger';

export async function connectToMongoDB(): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI);
    logger.info('Connected to MongoDB successfully');
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

export async function connectToRedis() {
  const client = createClient({
    url: env.REDIS_URL,
  });

  client.on('error', (error) => {
    logger.error('Redis Client Error:', error);
  });

  client.on('connect', () => {
    logger.info('Connected to Redis successfully');
  });

  await client.connect();
  return client;
}

// Graceful shutdown
export function setupGracefulShutdown() {
  const shutdown = async () => {
    logger.info('Initiating graceful shutdown...');
    
    try {
      await mongoose.disconnect();
      logger.info('MongoDB disconnected');
      
      const redis = await connectToRedis();
      await redis.quit();
      logger.info('Redis disconnected');
      
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
