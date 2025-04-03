import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

console.log('MongoDB URI:', MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//[username]:[password]@')); // Hide credentials in logs

const client = new MongoClient(MONGODB_URI, {
  serverSelectionTimeoutMS: 10000, // 10 second timeout
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  retryWrites: true
});

async function testConnection() {
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    console.log('Connected to MongoDB successfully');
    
    // Test the connection by listing the database collections
    const db = client.db();
    const collections = await db.listCollections().toArray();
    console.log(`Connected to database with ${collections.length} collections:`);
    collections.forEach(collection => console.log(`- ${collection.name}`));
    
    // Test a simple query
    try {
      const usersCollection = db.collection('users');
      const count = await usersCollection.countDocuments();
      console.log(`Found ${count} users in the database`);
    } catch (queryError) {
      console.warn('Could not query users collection:', queryError.message);
    }
    
  } catch (error) {
    console.error('MongoDB connection error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      codeName: error.codeName
    });
  } finally {
    await client.close();
    console.log('Connection closed');
  }
}

testConnection(); 