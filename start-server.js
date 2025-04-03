/**
 * Script to start the server with proper error handling
 */
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Check if we're running in Vercel environment
if (process.env.VERCEL) {
  console.log('Running in Vercel environment - skipping local server startup checks');
  process.exit(0);
}

// Check if the server is already running
const checkServerRunning = async () => {
  try {
    // Use different commands for different OSs
    const command = process.platform === 'win32' 
      ? 'netstat -ano | findstr :5000'
      : 'lsof -i :5000';
    
    return new Promise((resolve) => {
      exec(command, (error, stdout) => {
        if (error || !stdout.trim()) {
          resolve(false);
        } else {
          console.log('Server is already running on port 5000');
          resolve(true);
        }
      });
    });
  } catch (error) {
    console.error('Error checking if server is running:', error);
    return false;
  }
};

// Check if MongoDB is running
const checkMongoDBRunning = async () => {
  return new Promise((resolve) => {
    exec('mongod --version', (error) => {
      if (error) {
        console.log('MongoDB is not installed or not in the PATH');
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
};

// Check if .env file exists
const checkEnvFile = () => {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error('.env file not found');
    console.log('Creating .env file from .env.example...');
    
    try {
      const examplePath = path.join(process.cwd(), '.env.example');
      if (fs.existsSync(examplePath)) {
        fs.copyFileSync(examplePath, envPath);
        console.log('.env file created successfully');
        return true;
      } else {
        console.error('.env.example file not found');
        return false;
      }
    } catch (error) {
      console.error('Error creating .env file:', error);
      return false;
    }
  }
  return true;
};

// Start the server
const startServer = async () => {
  console.log('Starting server...');
  
  // Check if server is already running
  const isServerRunning = await checkServerRunning();
  if (isServerRunning) {
    console.log('Server is already running. Exiting...');
    return;
  }
  
  // Check if MongoDB is available
  const isMongoDBAvailable = await checkMongoDBRunning();
  if (!isMongoDBAvailable) {
    console.warn('MongoDB is not installed or not running. The server may not function correctly.');
  }
  
  // Check if .env file exists
  const hasEnvFile = checkEnvFile();
  if (!hasEnvFile) {
    console.error('Could not find or create .env file. The server may not function correctly.');
  }
  
  // Start the server
  const serverProcess = exec('node src/server/server.js', (error) => {
    if (error) {
      console.error('Error starting server:', error);
    }
  });
  
  // Log server output
  serverProcess.stdout.on('data', (data) => {
    console.log(data.toString().trim());
  });
  
  serverProcess.stderr.on('data', (data) => {
    console.error(data.toString().trim());
  });
  
  console.log('Server started on port 5000');
};

// Run the script
startServer().catch(error => {
  console.error('Failed to start server:', error);
}); 
