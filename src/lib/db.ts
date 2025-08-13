import mongoose from 'mongoose';
import { logger } from './logger';

// Global is used here to maintain a cached connection across hot reloads
const globalWithMongoose = global as typeof globalThis & {
  mongoose: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
};

const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local'
  );
}

// Initialize the cached connection
let cached = globalWithMongoose.mongoose;

if (!cached) {
  cached = globalWithMongoose.mongoose = { conn: null, promise: null };
}

/**
 * Connect to the MongoDB database
 * Reuses existing connection if available, creates a new one if not
 */
export async function connectToDatabase() {
  // In development, set to debug mode
  if (process.env.NODE_ENV === 'development') {
    mongoose.set('debug', (collectionName, method, query, doc) => {
      logger.debug('MongoDB Query', {
        collection: collectionName,
        method,
        query: JSON.stringify(query),
        doc: doc && JSON.stringify(doc),
      });
    });
  }

  // If we have a cached connection in development, return it immediately
  if (process.env.NODE_ENV === 'development' && cached.conn) {
    return cached.conn;
  }

  // If we don't have a connection promise, create one
  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Disable mongoose buffering
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout for server selection
      socketTimeoutMS: 45000, // 45 seconds timeout for queries
    };

    logger.info('Creating new database connection...');
    
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      logger.info('Successfully connected to MongoDB');
      return mongoose;
    }).catch((error) => {
      logger.error('MongoDB connection error:', error);
      // Clear the promise on error to allow retries
      cached.promise = null;
      throw error;
    });
  }

  try {
    // Wait for the connection promise to resolve
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (e) {
    // Clear the promise on error to allow retries
    cached.promise = null;
    throw e;
  }
}

// Connection events
mongoose.connection.on('connected', () => {
  logger.info('Mongoose connected to database');});

mongoose.connection.on('error', (err) => {
  logger.error('Mongoose connection error:', err);});

mongoose.connection.on('disconnected', () => {
  logger.warn('Mongoose disconnected');});

// Close the Mongoose connection when the Node process ends
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    logger.info('Mongoose connection closed through app termination');
    process.exit(0);
  } catch (err) {
    logger.error('Error closing mongoose connection:', err);
    process.exit(1);
  }
});

// Export the connection for direct use if needed
export const db = mongoose;

// Export a function to check if we're connected
export function isConnected(): boolean {
  return mongoose.connection.readyState === 1; // 1 = connected
}

// Export a function to close the connection (useful for tests)
export async function closeConnection(): Promise<void> {
  if (cached.conn) {
    await cached.conn.disconnect();
    cached.conn = null;
    cached.promise = null;
  }
}
