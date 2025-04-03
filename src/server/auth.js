import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Secret key for JWT signing (from environment variables)
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn('JWT_SECRET is not defined in environment variables, using fallback secret (not secure for production)');
}

/**
 * Middleware to authenticate requests using JWT
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];

    jwt.verify(token, JWT_SECRET || 'fallback-secret-key-change-this', (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Token is invalid or expired' });
      }

      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ error: 'Authentication token is missing' });
  }
};

/**
 * Generate JWT token for authenticated user
 * @param {Object} user - User object to encode in the token
 * @returns {String} JWT token
 */
const generateToken = (user) => {
  // Convert MongoDB ObjectId to string if needed
  const userId = user._id ? user._id.toString() : user.id;
  
  return jwt.sign(
    { 
      id: userId,
      email: user.email 
    }, 
    JWT_SECRET || 'fallback-secret-key-change-this', 
    { expiresIn: '24h' }
  );
};

export {
  authenticateJWT,
  generateToken
};
