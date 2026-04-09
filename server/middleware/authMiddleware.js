// server/middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Protect routes - requires a valid JWT token
export const protect = async (req, res, next) => {
  let token;

  // Check if the authorization header exists and starts with 'Bearer '
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Extract the token string
      token = req.headers.authorization.split(' ')[1];

      // Verify the token using your secret key
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Find the user in the database using the ID encoded in the token
      // We use .select('-password') to ensure we don't accidentally attach the hashed password to the request
      req.user = await User.findById(decoded.id).select('-password');

      // Proceed to the actual route controller
      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed or expired' });
    }
  }

  // If no token was found in the headers at all
  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

// Admin authorization - requires the user role to be 'admin'
export const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied: Admin privileges required' });
  }
};