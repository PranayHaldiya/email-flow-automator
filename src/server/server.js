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

// Declare agenda variable to be initialized after MongoDB connection
let agenda;

/**
 * Configure Nodemailer for email sending
 * - Uses environment variables for SMTP credentials
 * - Fallback to Gmail SMTP if not provided
 */
let transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Authentication routes - no JWT required
app.post('/api/register', registerUser);
app.post('/api/login', loginUser);

// Simple health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'Server is running', databaseConnected: !!agenda });
});

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
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();
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
    
    await client.close();
    
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
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();
    const flowsCollection = db.collection('flows');
    
    // Find the flow and verify ownership
    const flow = await flowsCollection.findOne({ _id: new ObjectId(id) });
    
    if (!flow) {
      await client.close();
      return res.status(404).json({ error: 'Flow not found' });
    }
    
    if (flow.userId !== userId) {
      await client.close();
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
    
    await client.close();
    
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
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();
    const flowsCollection = db.collection('flows');
    
    // Get all flows for the user
    const flows = await flowsCollection.find({ userId }).sort({ updatedAt: -1 }).toArray();
    
    await client.close();
    
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
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();
    const flowsCollection = db.collection('flows');
    
    // Find the flow and verify ownership
    const flow = await flowsCollection.findOne({ _id: new ObjectId(id) });
    
    await client.close();
    
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
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();
    const flowsCollection = db.collection('flows');
    
    // Find the flow and verify ownership
    const flow = await flowsCollection.findOne({ _id: new ObjectId(id) });
    
    if (!flow) {
      await client.close();
      return res.status(404).json({ error: 'Flow not found' });
    }
    
    if (flow.userId !== userId) {
      await client.close();
      return res.status(403).json({ error: 'Not authorized to delete this flow' });
    }
    
    // Delete the flow
    await flowsCollection.deleteOne({ _id: new ObjectId(id) });
    
    await client.close();
    
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
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();
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
    
    await client.close();
    
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
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();
    const templatesCollection = db.collection('emailTemplates');
    
    // Get all templates for the user
    const templates = await templatesCollection.find({ userId })
      .project({ name: 1, subject: 1, createdAt: 1, updatedAt: 1 })
      .sort({ updatedAt: -1 })
      .toArray();
    
    await client.close();
    
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
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();
    const templatesCollection = db.collection('emailTemplates');
    
    // Find the template
    const template = await templatesCollection.findOne({ _id: objectId });
    
    if (!template) {
      await client.close();
      return res.status(404).json({ error: 'Template not found' });
    }
    
    if (template.userId !== userId) {
      await client.close();
      return res.status(403).json({ error: 'Not authorized to access this template' });
    }
    
    await client.close();
    
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
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();
    const templatesCollection = db.collection('emailTemplates');
    
    // Find the template and verify ownership
    const template = await templatesCollection.findOne({ _id: objectId });
    
    if (!template) {
      await client.close();
      return res.status(404).json({ error: 'Template not found' });
    }
    
    if (template.userId !== userId) {
      await client.close();
      return res.status(403).json({ error: 'Not authorized to delete this template' });
    }
    
    // Delete the template
    await templatesCollection.deleteOne({ _id: objectId });
    
    await client.close();
    
    res.status(200).json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

/**
 * Initialize Agenda and define email job
 */
const initializeAgenda = async () => {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }
  
  agenda = new Agenda({
    db: { address: MONGODB_URI, collection: 'emailJobs' },
    processEvery: '1 minute'
  });

  // Define Agenda job for sending emails
  agenda.define('send email', async (job) => {
    const { to, subject, body, userId } = job.attrs.data;
    
    try {
      const info = await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject,
        text: body,
        html: `<div>${body}</div>`
      });

      console.log(`Email sent: ${info.messageId} by user ${userId}`);
      return info;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  });

  await agenda.start();
  console.log('Agenda started successfully');
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
    if (!agenda) {
      return res.status(503).json({ error: 'Scheduling service is not available' });
    }
    
    const { to, subject, body, delay, unit } = req.body;
    const userId = req.user.id;
    
    // Calculate when to send the email
    let sendTime = new Date();
    if (unit === 'minutes') {
      sendTime.setMinutes(sendTime.getMinutes() + delay);
    } else if (unit === 'hours') {
      sendTime.setHours(sendTime.getHours() + delay);
    } else if (unit === 'days') {
      sendTime.setDate(sendTime.getDate() + delay);
    }
    
    // Schedule the job
    await agenda.schedule(sendTime, 'send email', {
      to,
      subject,
      body,
      userId
    });
    
    res.status(200).json({ message: 'Email scheduled successfully', scheduledFor: sendTime });
  } catch (error) {
    console.error('Error scheduling email:', error);
    res.status(500).json({ error: 'Failed to schedule email' });
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
            // Schedule the email
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
  
  await agenda.schedule(sendTime, 'send email', {
    to,
    subject,
    body,
    userId
  });
  
  return { scheduledFor: sendTime };
}

/**
 * Start the server and connect to MongoDB
 */
const start = async () => {
  // Only start the server if not running in a serverless environment (Vercel)
  if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    // Start Express server first
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } else {
    console.log('Running in serverless mode on Vercel');
  }
  
  // Try to connect to MongoDB and initialize Agenda
  try {
    if (!MONGODB_URI) {
      console.error('MONGODB_URI is not defined in environment variables');
      return;
    }
    
    console.log('Connecting to MongoDB with URI:', MONGODB_URI.replace(/(mongodb\+srv:\/\/[^:]+):([^@]+)/, '$1:****'));
    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000, // 30 second timeout
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      retryWrites: true
    });
    
    await client.connect();
    console.log('Connected to MongoDB successfully');
    
    // Test the connection by listing the database collections
    const db = client.db();
    try {
      const collections = await db.listCollections().toArray();
      console.log(`Connected to database with ${collections.length} collections`);
      
      // Only initialize Agenda if MongoDB connected successfully
      await initializeAgenda();
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
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error('Connection refused. MongoDB server might not be running or not accessible.');
    }
    
    console.log('Server is running without database functionality');
  }
};

// In serverless environment, just export the app
if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
  // Connect to MongoDB without starting Express server
  start().catch(error => {
    console.error('Error in serverless initialization:', error);
  });
} else {
  // Regular environment - start everything
  start();
}

export default app;
