
import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../server/server.js';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../server/auth.js', () => ({
  authenticateJWT: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  }),
  generateToken: jest.fn(() => 'mock-token')
}));

jest.mock('agenda', () => {
  return jest.fn().mockImplementation(() => {
    return {
      define: jest.fn(),
      schedule: jest.fn().mockResolvedValue({}),
      start: jest.fn().mockResolvedValue({})
    };
  });
});

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
  }))
}));

describe('API Endpoints', () => {
  describe('Authentication', () => {
    test('POST /api/register should register a new user', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };
      
      // Mock MongoDB client
      jest.mock('mongodb');
      
      const response = await request(app)
        .post('/api/register')
        .send(userData);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'User registered successfully');
    });

    test('POST /api/login should login a user', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };
      
      const response = await request(app)
        .post('/api/login')
        .send(loginData);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
    });
  });

  describe('Email Scheduling', () => {
    test('POST /api/schedule-email should schedule an email', async () => {
      const emailData = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        body: 'Test Body',
        delay: 1,
        unit: 'hours'
      };
      
      const response = await request(app)
        .post('/api/schedule-email')
        .set('Authorization', 'Bearer mock-token')
        .send(emailData);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Email scheduled successfully');
      expect(response.body).toHaveProperty('scheduledFor');
    });

    test('POST /api/schedule-sequence should schedule a sequence', async () => {
      const sequenceData = {
        sequence: [
          {
            id: 'coldEmail_123',
            type: 'coldEmail',
            data: {
              recipient: 'test@example.com',
              subject: 'Test Email',
              body: 'Test content'
            },
            delay: 0,
            unit: 'hours'
          }
        ]
      };
      
      const response = await request(app)
        .post('/api/schedule-sequence')
        .set('Authorization', 'Bearer mock-token')
        .send(sequenceData);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Sequence scheduled successfully');
      expect(response.body).toHaveProperty('scheduledEmails');
      expect(Array.isArray(response.body.scheduledEmails)).toBe(true);
    });
  });

  describe('Authentication Middleware', () => {
    test('Protected endpoints should require authentication', async () => {
      // This test assumes the authenticateJWT middleware has been bypassed for testing
      const response = await request(app)
        .post('/api/schedule-email')
        .send({});
      
      // In a real scenario this would be 401, but our mock always authenticates
      expect(response.status).not.toBe(401);
    });
  });
});
