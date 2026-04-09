import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

import mongoSanitize from 'express-mongo-sanitize';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import companyRoutes from './routes/companyRoutes.js';
import holidayRoutes from './routes/holidayRoutes.js';

// 1. Initialize Environment Variables
// Loads variables from the .env file into process.env


// 2. Establish Database Connection
// Connects to the local or cloud MongoDB cluster
connectDB();

// 3. Initialize Express Application
const app = express();

// --- MIDDLEWARE CONFIGURATION ---

// Cross-Origin Resource Sharing (CORS)
// Allows your React frontend (typically running on port 5173 or 3000) to communicate with this API
app.use(cors());

// Body Parser
// Parses incoming requests with JSON payloads so they are accessible via req.body
app.use(express.json());
app.use((req, res, next) => {
  Object.defineProperty(req, 'query', {
    value: { ...req.query },
    writable: true,
    configurable: true,
    enumerable: true,
  });
  next();
});

// Security: Data Sanitization
// Strips out prohibited characters (like $ and .) from the req.body, req.query, and req.params 
// to prevent NoSQL query injection attacks
app.use(mongoSanitize());

// --- ROUTE MOUNTING ---

// Authentication Routes (Login, Register)
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/holidays', holidayRoutes);

// Health Check Route
// A simple endpoint to verify the server is active and responding
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'success',
    message: 'TNP Scheduler API is running securely!' 
  });
});

// --- SERVER INITIALIZATION ---
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});