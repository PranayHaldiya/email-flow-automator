import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import Agenda from 'agenda';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateJWT } from './auth.js';
import { registerUser, loginUser } from './users.js';

// Check if running on Vercel serverless environment
const isVercelServerless = process.env.VERCEL === '1';

// Get directory name in ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Debug environment variables
console.log("Environment variables:");
console.log("PORT:", process.env.PORT);
console.log("MONGODB_URI exists:", !!process.env.MONGODB_URI);
console.log("EMAIL_HOST:", process.env.EMAIL_HOST);
console.log("Running on Vercel:", isVercelServerless ? "Yes" : "No");

const app = express();
const PORT = process.env.PORT || 5000;

/**
 * Express app configuration
 * - CORS enabled for frontend to communicate with backend
 * - JSON parsing middleware for request bodies
 */
// Configure CORS to accept requests from specific origins with credentials
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // For Vercel deployment, allow API requests from the same domain
    // Also handle potential www. subdomains and custom domains
    const vercelDomain = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
    
    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:8080',
      'http://localhost:5000',
      vercelDomain,
      // Add any custom domains here
    ].filter(Boolean); // Remove null entries
    
    // In development mode or if origin matches deployment URL, allow it
    if (process.env.NODE_ENV !== 'production' || 
        // Check if request comes from the same domain as deployment
        (origin.startsWith(vercelDomain) || 
         // Allow the request if it's in our allowed origins
         allowedOrigins.some(allowed => allowed === origin || 
                             // Check for domain match regardless of protocol
                             (allowed && origin.endsWith(allowed.replace(/^https?:\/\//, '')))))) {
      return callback(null, origin);
    }
    
    // For all other origins in production, reject them
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // Allow credentials
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json());

// MongoDB connection string from environment variables
const MONGODB_URI = process.env.MONGODB_URI;

// Create a cached connection variable for serverless environment
let cachedClient = null;
let cachedDb = null;

/**
 * Connect to MongoDB with connection caching for serverless environments
 */
async function connectToDatabase() {
  // If we have a cached connection, use it
  if (cachedClient && cachedDb) {
    // Check if cached client is still connected with a proper timeout
    try {
      // Use a quick timeout for ping to avoid hanging
      await Promise.race([
        cachedClient.db().admin().ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Ping timeout')), 2000))
      ]);
      
      // Only log when in non-serverless environment to reduce spam
      if (!isVercelServerless) {
        console.log('Using cached MongoDB connection');
      }
      return { client: cachedClient, db: cachedDb };
    } catch (error) {
      console.log(`Connection check failed: ${error.message}. Creating a new one...`);
      // Connection is stale, close it safely and create a new one
      try {
        await cachedClient.close(true);
      } catch (closeError) {
        console.log('Error closing stale connection:', closeError.message);
      }
      cachedClient = null;
      cachedDb = null;
    }
  }

  // If no cached connection, create a new one
  console.log(`[${new Date().toISOString()}] Creating new MongoDB connection`);
  
  // Connection options optimized for serverless
  const options = {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 30000,
    maxPoolSize: 10,
    minPoolSize: 1,
    retryWrites: true
  };

  try {
    // Connect to database
    const client = new MongoClient(MONGODB_URI, options);
    await client.connect();
    const db = client.db();
    
    // Cache the connection
    cachedClient = client;
    cachedDb = db;
    
    console.log(`[${new Date().toISOString()}] MongoDB connection established successfully`);
    return { client, db };
  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    throw error;
  }
}

// Declare agenda variable to be initialized after MongoDB connection
let agenda;

// Add this below the declaration of agenda variable
let agendaInitialized = false;

// Now fix the Nodemailer transporter with better debugging
let transporter = null;

/**
 * Initialize the email transporter with the current settings
 */
function initializeTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('EMAIL_USER or EMAIL_PASS is not set in environment variables');
    return false;
  }

  try {
    console.log(`Setting up email transporter with ${process.env.EMAIL_USER} via ${process.env.EMAIL_HOST || 'smtp.gmail.com'}`);
    
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587', 10),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      debug: true // Enable debug output
    });
    
    return true;
  } catch (error) {
    console.error('Failed to create email transporter:', error);
    return false;
  }
}

// Initialize transporter on startup
initializeTransporter();

// Authentication routes - no JWT required
app.post('/api/register', registerUser);
app.post('/api/login', loginUser);

// Update the health check endpoint
app.get('/api/health', async (req, res) => {
  let dbConnected = false;
  
  try {
    // Try to connect to MongoDB
    const { client, db } = await connectToDatabase();
    
    // Ping the database to verify connection
    await db.command({ ping: 1 });
    dbConnected = true;
    
    if (shouldCloseClient()) {
      await client.close();
    }
  } catch (error) {
    console.error('Health check failed to connect to database:', error.message);
    dbConnected = false;
  }
  
  res.status(200).json({ 
    status: 'Server is running', 
    databaseConnected: dbConnected,
    serverless: isVercelServerless 
  });
});

/**
 * Helper function to decide whether to close MongoDB client or keep it open
 * In serverless environments, we keep the connection open for reuse
 */
function shouldCloseClient() {
  return !isVercelServerless; // Only close in non-serverless environments
}

/**
 * API endpoint to save a flow configuration
 * @route POST /api/flows
 * @param {string} name - Name of the flow
 * @param {Array} nodes - Flow nodes configuration
 * @param {Array} edges - Flow edges configuration
 * @returns {Object} Saved flow data with ID
 */
app.post('/api/flows', authenticateJWT, async (req, res) => {
  try {
    const { name, nodes, edges } = req.body;
    const userId = req.user.id;
    
    if (!name) {
      return res.status(400).json({ error: 'Flow name is required' });
    }
    
    // Connect to MongoDB
    const { client, db } = await connectToDatabase();
    const flowsCollection = db.collection('flows');
    
    // Save the flow
    const result = await flowsCollection.insertOne({
      name,
      nodes,
      edges,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Only close the client if not in serverless environment
    if (shouldCloseClient()) {
      await client.close();
    }
    
    res.status(201).json({
      message: 'Flow saved successfully',
      flowId: result.insertedId,
      name
    });
  } catch (error) {
    console.error('Error saving flow:', error);
    res.status(500).json({ error: 'Failed to save flow' });
  }
});

/**
 * API endpoint to update an existing flow
 * @route PUT /api/flows/:id
 * @param {string} id - Flow ID
 * @param {string} name - Name of the flow
 * @param {Array} nodes - Flow nodes configuration
 * @param {Array} edges - Flow edges configuration
 * @returns {Object} Updated flow data
 */
app.put('/api/flows/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, nodes, edges } = req.body;
    const userId = req.user.id;
    
    // Connect to MongoDB
    const { client, db } = await connectToDatabase();
    const flowsCollection = db.collection('flows');
    
    // Find the flow and verify ownership
    const flow = await flowsCollection.findOne({ _id: new ObjectId(id) });
    
    if (!flow) {
      if (shouldCloseClient()) {
        await client.close();
      }
      return res.status(404).json({ error: 'Flow not found' });
    }
    
    if (flow.userId !== userId) {
      if (shouldCloseClient()) {
        await client.close();
      }
      return res.status(403).json({ error: 'Not authorized to modify this flow' });
    }
    
    // Update the flow
    await flowsCollection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: {
          name: name || flow.name,
          nodes: nodes || flow.nodes,
          edges: edges || flow.edges,
          updatedAt: new Date()
        } 
      }
    );
    
    if (shouldCloseClient()) {
      await client.close();
    }
    
    res.status(200).json({
      message: 'Flow updated successfully',
      flowId: id,
      name: name || flow.name
    });
  } catch (error) {
    console.error('Error updating flow:', error);
    res.status(500).json({ error: 'Failed to update flow' });
  }
});

/**
 * API endpoint to get all flows for a user
 * @route GET /api/flows
 * @returns {Array} List of user's flows
 */
app.get('/api/flows', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Connect to MongoDB
    const { client, db } = await connectToDatabase();
    const flowsCollection = db.collection('flows');
    
    // Get all flows for the user
    const flows = await flowsCollection.find({ userId }).sort({ updatedAt: -1 }).toArray();
    
    if (shouldCloseClient()) {
      await client.close();
    }
    
    res.status(200).json({
      flows: flows.map(flow => ({
        id: flow._id,
        name: flow.name,
        updatedAt: flow.updatedAt,
        createdAt: flow.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching flows:', error);
    res.status(500).json({ error: 'Failed to fetch flows' });
  }
});

/**
 * API endpoint to get a specific flow
 * @route GET /api/flows/:id
 * @param {string} id - Flow ID
 * @returns {Object} Flow data
 */
app.get('/api/flows/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Connect to MongoDB
    const { client, db } = await connectToDatabase();
    const flowsCollection = db.collection('flows');
    
    // Find the flow and verify ownership
    const flow = await flowsCollection.findOne({ _id: new ObjectId(id) });
    
    if (shouldCloseClient()) {
      await client.close();
    }
    
    if (!flow) {
      return res.status(404).json({ error: 'Flow not found' });
    }
    
    if (flow.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to access this flow' });
    }
    
    res.status(200).json({
      id: flow._id,
      name: flow.name,
      nodes: flow.nodes,
      edges: flow.edges,
      createdAt: flow.createdAt,
      updatedAt: flow.updatedAt
    });
  } catch (error) {
    console.error('Error fetching flow:', error);
    res.status(500).json({ error: 'Failed to fetch flow' });
  }
});

/**
 * API endpoint to delete a flow
 * @route DELETE /api/flows/:id
 * @param {string} id - Flow ID
 * @returns {Object} Deletion confirmation
 */
app.delete('/api/flows/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Connect to MongoDB
    const { client, db } = await connectToDatabase();
    const flowsCollection = db.collection('flows');
    
    // Find the flow and verify ownership
    const flow = await flowsCollection.findOne({ _id: new ObjectId(id) });
    
    if (!flow) {
      if (shouldCloseClient()) {
        await client.close();
      }
      return res.status(404).json({ error: 'Flow not found' });
    }
    
    if (flow.userId !== userId) {
      if (shouldCloseClient()) {
        await client.close();
      }
      return res.status(403).json({ error: 'Not authorized to delete this flow' });
    }
    
    // Delete the flow
    await flowsCollection.deleteOne({ _id: new ObjectId(id) });
    
    if (shouldCloseClient()) {
      await client.close();
    }
    
    res.status(200).json({
      message: 'Flow deleted successfully',
      flowId: id
    });
  } catch (error) {
    console.error('Error deleting flow:', error);
    res.status(500).json({ error: 'Failed to delete flow' });
  }
});

/**
 * API endpoint to create a new email template
 * @route POST /api/templates
 * @param {string} name - Name of the template
 * @param {string} subject - Email subject
 * @param {string} body - Email body content
 * @returns {Object} Saved template data with ID
 */
app.post('/api/templates', authenticateJWT, async (req, res) => {
  try {
    const { name, subject, body } = req.body;
    const userId = req.user.id;
    
    if (!name || !subject || !body) {
      return res.status(400).json({ error: 'Template name, subject, and body are required' });
    }
    
    // Connect to MongoDB
    const { client, db } = await connectToDatabase();
    const templatesCollection = db.collection('emailTemplates');
    
    // Save the template
    const result = await templatesCollection.insertOne({
      name,
      subject,
      body,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    if (shouldCloseClient()) {
      await client.close();
    }
    
    res.status(201).json({
      message: 'Email template saved successfully',
      templateId: result.insertedId,
      name
    });
  } catch (error) {
    console.error('Error saving email template:', error);
    res.status(500).json({ error: 'Failed to save email template' });
  }
});

/**
 * API endpoint to get all email templates for a user
 * @route GET /api/templates
 * @returns {Array} List of user's email templates
 */
app.get('/api/templates', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Connect to MongoDB
    const { client, db } = await connectToDatabase();
    const templatesCollection = db.collection('emailTemplates');
    
    // Get all templates for the user
    const templates = await templatesCollection.find({ userId })
      .project({ name: 1, subject: 1, createdAt: 1, updatedAt: 1 })
      .sort({ updatedAt: -1 })
      .toArray();
    
    if (shouldCloseClient()) {
      await client.close();
    }
    
    // Map MongoDB _id to id for frontend consumption
    const mappedTemplates = templates.map(template => ({
      id: template._id.toString(),
      name: template.name,
      subject: template.subject,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt
    }));
    
    res.status(200).json({ templates: mappedTemplates });
  } catch (error) {
    console.error('Error fetching email templates:', error);
    res.status(500).json({ error: 'Failed to fetch email templates' });
  }
});

/**
 * API endpoint to get a specific email template
 * @route GET /api/templates/:id
 * @param {string} id - Template ID
 * @returns {Object} Template data
 */
app.get('/api/templates/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Validate ObjectId format
    let objectId;
    try {
      objectId = new ObjectId(id);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid template ID format' });
    }
    
    // Connect to MongoDB
    const { client, db } = await connectToDatabase();
    const templatesCollection = db.collection('emailTemplates');
    
    // Find the template
    const template = await templatesCollection.findOne({ _id: objectId });
    
    if (!template) {
      if (shouldCloseClient()) {
        await client.close();
      }
      return res.status(404).json({ error: 'Template not found' });
    }
    
    if (template.userId !== userId) {
      if (shouldCloseClient()) {
        await client.close();
      }
      return res.status(403).json({ error: 'Not authorized to access this template' });
    }
    
    if (shouldCloseClient()) {
      await client.close();
    }
    
    // Include id for frontend consumption
    const mappedTemplate = {
      ...template,
      id: template._id.toString()
    };
    
    res.status(200).json({ template: mappedTemplate });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

/**
 * API endpoint to delete an email template
 * @route DELETE /api/templates/:id
 * @param {string} id - Template ID
 * @returns {Object} Deletion confirmation
 */
app.delete('/api/templates/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Validate ObjectId format
    let objectId;
    try {
      objectId = new ObjectId(id);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid template ID format' });
    }
    
    // Connect to MongoDB
    const { client, db } = await connectToDatabase();
    const templatesCollection = db.collection('emailTemplates');
    
    // Find the template and verify ownership
    const template = await templatesCollection.findOne({ _id: objectId });
    
    if (!template) {
      if (shouldCloseClient()) {
        await client.close();
      }
      return res.status(404).json({ error: 'Template not found' });
    }
    
    if (template.userId !== userId) {
      if (shouldCloseClient()) {
        await client.close();
      }
      return res.status(403).json({ error: 'Not authorized to delete this template' });
    }
    
    // Delete the template
    await templatesCollection.deleteOne({ _id: objectId });
    
    if (shouldCloseClient()) {
      await client.close();
    }
    
    res.status(200).json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

/**
 * Initialize Agenda scheduling system with improved connection handling
 */
const initializeAgenda = async () => {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }
  
  // If agenda is already initialized, return it
  if (agenda && agendaInitialized) {
    console.log('Using existing Agenda instance');
    return agenda;
  }
  
  try {
    console.log(`[${new Date().toISOString()}] Initializing Agenda with MongoDB connection`);
    
    // Get the cached MongoDB connection - ensures one connection is maintained
    const { db } = await connectToDatabase();
    
    // Create a new Agenda instance with the database connection
    agenda = new Agenda({
      mongo: db,
      collection: 'emailJobs',
      processEvery: '20 seconds',
      defaultConcurrency: 5
    });

    // Define Agenda job for sending emails
    agenda.define('send email', async (job) => {
      const { to, subject, body, userId } = job.attrs.data;
      
      try {
        console.log(`[${new Date().toISOString()}] Attempting to send email to ${to} with subject "${subject}"`);
        
        // Verify we have a transporter
        if (!transporter) {
          console.log('Transporter not available, initializing...');
          if (!initializeTransporter()) {
            throw new Error('Failed to initialize email transporter');
          }
        }
        
        // Verify transporter is working with a test
        await new Promise((resolve, reject) => {
          transporter.verify(function (error) {
            if (error) {
              console.error('Transporter verification failed:', error);
              reject(error);
            } else {
              console.log('Transporter is ready to send messages');
              resolve();
            }
          });
        });

        const info = await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to,
          subject,
          text: body,
          html: `<div>${body}</div>`
        });

        console.log(`Email sent: ${info.messageId} by user ${userId}`);
        console.log('Email response:', JSON.stringify(info));
        return info;
      } catch (error) {
        console.error(`Error sending email to ${to}:`, error);
        
        // Try to reinitialize the transporter on error
        console.log('Attempting to reinitialize email transporter...');
        initializeTransporter();
        
        throw error;
      }
    });

    await agenda.start();
    console.log('Agenda started successfully');
    agendaInitialized = true;
    return agenda;
  } catch (error) {
    console.error('Failed to initialize Agenda:', error);
    agendaInitialized = false;
    throw error;
  }
};

// Define protected routes - JWT required for these routes
// FIX: Change the middleware application to avoid path-to-regexp issues
// Instead of applying to all '/api' routes, apply to specific protected endpoints

/**
 * API endpoint to schedule an email
 * @route POST /api/schedule-email
 * @param {string} to - Email recipient
 * @param {string} subject - Email subject
 * @param {string} body - Email content
 * @param {number} delay - Time delay before sending
 * @param {string} unit - Time unit (minutes, hours, days)
 * @returns {Object} Scheduling confirmation with time
 */
app.post('/api/schedule-email', authenticateJWT, async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Received request to schedule email`);
    
    // First, verify email settings are configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error('EMAIL_USER or EMAIL_PASS is not set in environment variables');
      return res.status(500).json({ 
        error: 'Email configuration is missing', 
        details: 'The server is not configured with valid email credentials'
      });
    }
    
    // Make sure Agenda is initialized before using it
    if (!agenda || !agendaInitialized) {
      console.log('Agenda not initialized, initializing now...');
      await initializeAgenda();
    }
    
    if (!agenda) {
      console.error('Failed to initialize Agenda');
      return res.status(503).json({ error: 'Scheduling service is not available' });
    }
    
    const { to, subject, body, delay, unit } = req.body;
    const userId = req.user.id;
    
    console.log(`Scheduling email to: ${to}, subject: ${subject}, delay: ${delay} ${unit}`);
    
    // Calculate when to send the email
    let sendTime = new Date();
    if (unit === 'minutes') {
      sendTime.setMinutes(sendTime.getMinutes() + delay);
    } else if (unit === 'hours') {
      sendTime.setHours(sendTime.getHours() + delay);
    } else if (unit === 'days') {
      sendTime.setDate(sendTime.getDate() + delay);
    }
    
    console.log(`Email will be sent at: ${sendTime.toISOString()}`);
    
    try {
      // Make sure we have a database connection for agenda operations
      await connectToDatabase();
      
      // Verify transporter is working
      if (!transporter) {
        console.log('Email transporter not initialized, initializing now...');
        if (!initializeTransporter()) {
          return res.status(500).json({ error: 'Failed to initialize email service' });
        }
      }
      
      // Schedule the job
      const job = await agenda.schedule(sendTime, 'send email', {
        to,
        subject,
        body,
        userId
      });
      
      console.log(`Job scheduled with ID: ${job.attrs._id}`);
      
      // Verify the job was scheduled by checking it exists in the database
      const { db } = await connectToDatabase();
      const jobsCollection = db.collection('emailJobs');
      const scheduledJob = await jobsCollection.findOne({ _id: job.attrs._id });
      
      if (!scheduledJob) {
        console.error('Job was not found in the database after scheduling');
        return res.status(500).json({ error: 'Failed to verify job was scheduled' });
      }
      
      console.log('Email scheduling verified in database');
      res.status(200).json({ 
        message: 'Email scheduled successfully', 
        scheduledFor: sendTime,
        jobId: job.attrs._id.toString()
      });
    } catch (err) {
      console.error('Error scheduling email:', err);
      
      // If there's a connection error, try to reinitialize Agenda
      if (err.name === 'MongoNotConnectedError') {
        console.log('Attempting to reconnect to MongoDB for Agenda...');
        await initializeAgenda();
        
        // Try to schedule the email again after reconnection
        const job = await agenda.schedule(sendTime, 'send email', {
          to,
          subject,
          body,
          userId
        });
        
        res.status(200).json({ 
          message: 'Email scheduled successfully after reconnection', 
          scheduledFor: sendTime,
          jobId: job.attrs._id.toString()
        });
      } else {
        throw err; // Re-throw if it's not a connection error
      }
    }
  } catch (error) {
    console.error('Error scheduling email:', error);
    res.status(500).json({ error: 'Failed to schedule email', details: error.message });
  }
});

/**
 * API endpoint to schedule an entire email sequence
 * @route POST /api/schedule-sequence
 * @param {Array} sequence - Array of email sequence nodes
 * @param {Object} schedulingOptions - Options for scheduling (days, time range, start date)
 * @param {Boolean} sendNow - Whether to send the emails immediately
 * @returns {Object} Array of scheduled emails with times
 */
app.post('/api/schedule-sequence', authenticateJWT, async (req, res) => {
  try {
    // Make sure Agenda is initialized before using it
    if (!agenda || !agendaInitialized) {
      await initializeAgenda();
    }
    
    if (!agenda) {
      return res.status(503).json({ error: 'Scheduling service is not available' });
    }
    
    const { sequence, schedulingOptions, sendNow } = req.body;
    const userId = req.user.id;
    const scheduledEmails = [];
    
    // If sendNow is true, send all emails immediately
    if (sendNow) {
      let hasValidEmails = false;
      let hasMissingRecipients = false;
      
      console.log('Immediate send mode selected. Processing sequence with', sequence.length, 'items');
      
      // Make sure we have a database connection for agenda operations
      await connectToDatabase();
      
      for (const item of sequence) {
        if (item.type === 'coldEmail') {
          // Validate that recipient exists
          if (!item.data?.recipient) {
            console.warn('Missing recipient in email node:', item.id);
            hasMissingRecipients = true;
            continue; // Skip this item
          }
          
          hasValidEmails = true;
          
          // Log the data we're processing
          console.log('Scheduling immediate email to:', item.data.recipient, 
                     'Subject:', item.data.subject?.substring(0, 30));
          
          // Schedule for immediate sending (within the next minute)
          const sendTime = new Date();
          sendTime.setMinutes(sendTime.getMinutes() + 1);  // Add a minute to ensure it's in the future
          
          try {
            // Schedule the email with error handling
            await agenda.schedule(sendTime, 'send email', {
              to: item.data.recipient,
              subject: item.data.subject || 'No Subject',
              body: item.data.body || '',
              userId
            });
            
            scheduledEmails.push({
              email: item.data.recipient,
              subject: item.data.subject || 'No Subject',
              scheduledFor: sendTime
            });
            
            console.log('Successfully scheduled immediate email to:', item.data.recipient);
          } catch (err) {
            console.error('Error scheduling individual email:', err);
            
            // If there's a connection error, try to reinitialize Agenda
            if (err.name === 'MongoNotConnectedError') {
              console.log('Attempting to reconnect to MongoDB for Agenda...');
              await initializeAgenda();
              
              // Try to schedule the email again after reconnection
              try {
                await agenda.schedule(sendTime, 'send email', {
                  to: item.data.recipient,
                  subject: item.data.subject || 'No Subject',
                  body: item.data.body || '',
                  userId
                });
                
                scheduledEmails.push({
                  email: item.data.recipient,
                  subject: item.data.subject || 'No Subject',
                  scheduledFor: sendTime
                });
                
                console.log('Successfully scheduled email after reconnection');
              } catch (retryErr) {
                console.error('Failed to schedule email after reconnection:', retryErr);
              }
            }
          }
        }
      }
      
      if (!hasValidEmails) {
        const errorMessage = hasMissingRecipients 
          ? 'None of your email nodes have recipient addresses. Please add recipient email addresses to your nodes.' 
          : 'No valid email nodes found in the sequence.';
        
        return res.status(400).json({ 
          error: errorMessage,
          message: 'Failed to send emails'
        });
      }
      
      return res.status(200).json({ 
        message: 'Sequence sent successfully', 
        scheduledEmails
      });
    }
    
    // If we're here, then we're scheduling for later
    // Default scheduling options if not provided
    const options = {
      startDate: new Date(),
      fromTime: '09:00',
      toTime: '17:00',
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      ...schedulingOptions
    };
    
    // Convert startDate string to Date object if it's not already
    const startDate = options.startDate instanceof Date ? 
      options.startDate : 
      new Date(options.startDate);
    
    // Parse time strings
    const [fromHour] = options.fromTime.split(':').map(Number);
    const [toHour] = options.toTime.split(':').map(Number);
    
    // Create a map of day names to day numbers (0 = Sunday, 1 = Monday, etc.)
    const dayMap = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6
    };
    
    // Convert day names to day numbers
    const scheduleDays = options.days.map(day => dayMap[day.toLowerCase()]);
    
    // Generate schedule for each email in the sequence
    let emailIndex = 0;
    let currentDate = new Date(startDate);
    
    // Process each node in the sequence
    for (const item of sequence) {
      if (item.type === 'coldEmail') {
        // Find the next valid day for scheduling
        let foundValidDay = false;
        let daysChecked = 0;
        
        while (!foundValidDay && daysChecked < 14) { // Check up to 14 days ahead
          const dayOfWeek = currentDate.getDay();
          
          if (scheduleDays.includes(dayOfWeek)) {
            // This is a valid day to send
            foundValidDay = true;
            
            // Choose a random hour within the specified range
            const randomHour = Math.floor(Math.random() * (toHour - fromHour + 1)) + fromHour;
            const randomMinute = Math.floor(Math.random() * 60);
            
            // Set the send time
            const sendTime = new Date(currentDate);
            sendTime.setHours(randomHour, randomMinute, 0, 0);
            
            // Only schedule if the time is in the future
            if (sendTime > new Date()) {
              // Schedule the email
              await agenda.schedule(sendTime, 'send email', {
                to: item.data.recipient,
                subject: item.data.subject,
                body: item.data.body,
                userId
              });
              
              scheduledEmails.push({
                email: item.data.recipient,
                subject: item.data.subject,
                scheduledFor: sendTime
              });
              
              // Move to the next day for the next email
              currentDate.setDate(currentDate.getDate() + 1);
            }
          } else {
            // Move to the next day
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          daysChecked++;
        }
        
        emailIndex++;
      }
    }
    
    res.status(200).json({ 
      message: 'Sequence scheduled successfully', 
      scheduledEmails,
      schedulingOptions: options
    });
  } catch (error) {
    console.error('Error scheduling sequence:', error);
    res.status(500).json({ error: 'Failed to schedule sequence' });
  }
});

/**
 * Helper function to schedule an email
 * @param {Object} options - Email options including recipient, subject, etc.
 * @returns {Object} Scheduled time information
 */
async function scheduleEmail({ to, subject, body, delay, unit, userId }) {
  // Make sure Agenda is initialized before using it
  if (!agenda || !agendaInitialized) {
    await initializeAgenda();
  }
  
  if (!agenda) {
    throw new Error('Scheduling service is not available');
  }
  
  let sendTime = new Date();
  if (unit === 'minutes') {
    sendTime.setMinutes(sendTime.getMinutes() + delay);
  } else if (unit === 'hours') {
    sendTime.setHours(sendTime.getHours() + delay);
  } else if (unit === 'days') {
    sendTime.setDate(sendTime.getDate() + delay);
  }
  
  try {
    // Make sure we have a database connection for agenda operations
    await connectToDatabase();
    
    await agenda.schedule(sendTime, 'send email', {
      to,
      subject,
      body,
      userId
    });
    
    return { scheduledFor: sendTime };
  } catch (err) {
    console.error('Error in scheduleEmail helper:', err);
    
    // If there's a connection error, try to reinitialize Agenda
    if (err.name === 'MongoNotConnectedError') {
      console.log('Attempting to reconnect to MongoDB for Agenda...');
      await initializeAgenda();
      
      // Try to schedule the email again after reconnection
      await agenda.schedule(sendTime, 'send email', {
        to,
        subject,
        body,
        userId
      });
      
      return { scheduledFor: sendTime, reconnected: true };
    }
    
    throw err; // Re-throw if it's not a connection error we can handle
  }
}

// Add a job completion listener to monitor job execution
if (agenda) {
  agenda.on('complete', job => {
    console.log(`Job ${job.attrs.name} completed for ${job.attrs.data.to}`);
  });

  agenda.on('fail', (error, job) => {
    console.error(`Job ${job.attrs.name} failed with error:`, error);
  });
  
  // Add a periodic check for pending jobs to ensure processing is working
  setInterval(async () => {
    if (agenda && agendaInitialized) {
      try {
        // Connect to the database
        const { db } = await connectToDatabase();
        const jobsCollection = db.collection('emailJobs');
        
        // Find pending jobs
        const pendingJobs = await jobsCollection.countDocuments({
          nextRunAt: { $ne: null },
          lockedAt: null
        });
        
        if (pendingJobs > 0) {
          console.log(`[${new Date().toISOString()}] Found ${pendingJobs} pending jobs waiting to be processed`);
        }
        
        // Find locked jobs that might be stuck
        const lockedJobs = await jobsCollection.countDocuments({
          lockedAt: { $ne: null }
        });
        
        if (lockedJobs > 0) {
          console.log(`[${new Date().toISOString()}] Found ${lockedJobs} locked jobs that might be stuck`);
          
          // If we find locked jobs older than 5 minutes, unlock them
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          await jobsCollection.updateMany(
            { lockedAt: { $lt: fiveMinutesAgo } },
            { $set: { lockedAt: null } }
          );
        }
      } catch (error) {
        console.error('Error checking job status:', error);
      }
    }
  }, 60000); // Check every minute
}

// Update the start function to better monitor Agenda's status
const start = async () => {
  // Only start the Express server listener if not in serverless mode
  if (!isVercelServerless) {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } else {
    console.log("Running in serverless mode - no need to start server listener");
  }
  
  // Try to connect to MongoDB and initialize Agenda
  try {
    if (!MONGODB_URI) {
      console.error('MONGODB_URI is not defined in environment variables');
      return;
    }
    
    console.log('Connecting to MongoDB with URI:', MONGODB_URI.replace(/(mongodb\+srv:\/\/[^:]+):([^@]+)/, '$1:****'));
    
    // Use the optimized connection function
    const { client, db } = await connectToDatabase();
    
    console.log('Connected to MongoDB successfully');
    
    // Test the connection by listing the database collections
    try {
      const collections = await db.listCollections().toArray();
      console.log(`Connected to database with ${collections.length} collections`);
      
      // Check if emailJobs collection exists and log job count
      if (collections.some(c => c.name === 'emailJobs')) {
        const jobsCollection = db.collection('emailJobs');
        const jobCount = await jobsCollection.countDocuments();
        console.log(`Found ${jobCount} email jobs in the database`);
        
        // Check for pending jobs
        const pendingJobs = await jobsCollection.countDocuments({
          nextRunAt: { $ne: null },
          lockedAt: null
        });
        
        console.log(`Found ${pendingJobs} pending jobs to be processed`);
      }
      
      // Only initialize Agenda if MongoDB connected successfully
      try {
        const agendaInstance = await initializeAgenda();
        if (agendaInstance) {
          console.log('Agenda initialized successfully during startup');
          
          // Check if the email configuration is valid
          if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.error('⚠️ WARNING: EMAIL_USER or EMAIL_PASS is not set. Emails will not be sent!');
          } else {
            console.log(`Email configured for: ${process.env.EMAIL_USER}`);
            
            // Test the email connection
            if (!transporter) {
              initializeTransporter();
            }
            
            if (transporter) {
              try {
                await new Promise((resolve, reject) => {
                  transporter.verify(function (error) {
                    if (error) {
                      console.error('⚠️ Email transporter verification failed:', error);
                      reject(error);
                    } else {
                      console.log('✅ Email transporter is ready to send messages');
                      resolve();
                    }
                  });
                });
              } catch (emailError) {
                console.error('Email service is not properly configured:', emailError.message);
              }
            }
          }
        }
      } catch (agendaError) {
        console.error('Failed to initialize Agenda during startup:', agendaError.message);
        // Continue running the server even if Agenda failed to initialize
        // We'll retry when a scheduling operation is attempted
      }
    } catch (dbError) {
      console.error('Database operation error:', dbError.message);
      
      // Check for authorization errors
      if (dbError.message.includes('not authorized')) {
        console.error('This appears to be an authorization error. Please check your MongoDB user permissions.');
      }
    }
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    
    // More detailed error handling
    if (error.name === 'MongoServerError' && error.message.includes('bad auth')) {
      console.error('Authentication failed. Please check your username and password in the MongoDB URI.');
      console.error('Make sure the MongoDB user exists and has the correct permissions.');
    } else if (error.name === 'MongoTimeoutError') {
      console.error('Connection timed out. Please check if the MongoDB server is running and accessible.');
      console.error('If using MongoDB Atlas, ensure your IP whitelist includes 0.0.0.0/0 to allow all connections.');
      console.error('Verify that your database user has the correct access rights.');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error('Connection refused. MongoDB server might not be running or not accessible.');
    }
    
    console.log('Server is running without database functionality');
  }
};

// In serverless environment, just connect to DB without blocking
if (isVercelServerless) {
  start().catch(error => {
    console.error('Error in serverless initialization:', error);
  });
} else {
  // Regular environment - start everything
  start();
}

/**
 * API endpoint to diagnose email issues
 * @route GET /api/diagnose-email
 * @returns {Object} Diagnostic information
 */
app.get('/api/diagnose-email', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Starting email diagnostics`);
    
    const diagnosticResults = {
      email: {
        configured: false,
        username: process.env.EMAIL_USER ? 'Set' : 'Not Set',
        password: process.env.EMAIL_PASS ? 'Set' : 'Not Set',
        host: process.env.EMAIL_HOST || 'Not Set',
        port: process.env.EMAIL_PORT || 'Not Set',
        verifyResult: null
      },
      agenda: {
        initialized: agendaInitialized,
        jobsInQueue: 0,
        pendingJobs: 0
      },
      mongodb: {
        connected: false,
        collections: []
      }
    };
    
    // Test MongoDB connection
    try {
      const { db } = await connectToDatabase();
      diagnosticResults.mongodb.connected = true;
      
      // Get collections
      const collections = await db.listCollections().toArray();
      diagnosticResults.mongodb.collections = collections.map(c => c.name);
      
      // Check for pending jobs
      if (collections.some(c => c.name === 'emailJobs')) {
        const jobsCollection = db.collection('emailJobs');
        diagnosticResults.agenda.jobsInQueue = await jobsCollection.countDocuments();
        diagnosticResults.agenda.pendingJobs = await jobsCollection.countDocuments({
          nextRunAt: { $ne: null },
          lockedAt: null
        });
      }
    } catch (dbError) {
      console.error('Diagnostic MongoDB check failed:', dbError);
    }
    
    // Test email configuration
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      diagnosticResults.email.configured = true;
      
      // Initialize transporter if needed
      if (!transporter) {
        initializeTransporter();
      }
      
      // Verify email connection
      try {
        const verifyResult = await new Promise((resolve) => {
          transporter.verify(function(error, success) {
            if (error) {
              resolve({ success: false, error: error.message });
            } else {
              resolve({ success: true });
            }
          });
        });
        
        diagnosticResults.email.verifyResult = verifyResult;
      } catch (emailError) {
        diagnosticResults.email.verifyResult = { 
          success: false, 
          error: emailError.message 
        };
      }
    }
    
    res.status(200).json({
      timestamp: new Date().toISOString(),
      diagnostics: diagnosticResults,
      isVercelServerless: isVercelServerless,
      environmentVariables: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        MONGODB_URI_SET: !!process.env.MONGODB_URI,
        EMAIL_HOST_SET: !!process.env.EMAIL_HOST,
        EMAIL_USER_SET: !!process.env.EMAIL_USER,
        EMAIL_PASS_SET: !!process.env.EMAIL_PASS
      }
    });
  } catch (error) {
    console.error('Email diagnostic error:', error);
    res.status(500).json({ error: 'Diagnostic failed', details: error.message });
  }
});

/**
 * API endpoint to send a test email
 * @route POST /api/test-email
 * @param {string} to - Email recipient
 * @returns {Object} Test result
 */
app.post('/api/test-email', async (req, res) => {
  try {
    const { to } = req.body;
    
    if (!to) {
      return res.status(400).json({ error: 'Email recipient is required' });
    }
    
    // Initialize email transporter if needed
    if (!transporter) {
      console.log('Initializing email transporter for test...');
      if (!initializeTransporter()) {
        return res.status(500).json({ 
          error: 'Failed to initialize email service',
          details: 'Check your EMAIL_USER and EMAIL_PASS environment variables'
        });
      }
    }
    
    console.log(`Sending test email to ${to}...`);
    
    // Try to send a test email
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: to,
      subject: 'Test Email from Flow Email Automator',
      text: 'This is a test email from your Flow Email Automator application.',
      html: '<div><h2>Test Email</h2><p>This is a test email from your Flow Email Automator application.</p></div>'
    });
    
    console.log('Test email sent:', info.messageId);
    
    res.status(200).json({
      success: true,
      messageId: info.messageId,
      response: info.response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test email',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default app;
