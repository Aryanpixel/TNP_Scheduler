// server/Server.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
dotenv.config();

import mongoSanitize from 'express-mongo-sanitize';
import connectDB from './config/db.js';
import authRoutes     from './routes/authRoutes.js';
import companyRoutes  from './routes/companyRoutes.js';
import holidayRoutes  from './routes/holidayRoutes.js';
import slotNoteRoutes from './routes/slotNoteRoutes.js';

connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  Object.defineProperty(req, 'query', {
    value: { ...req.query }, writable: true, configurable: true, enumerable: true,
  });
  next();
});
app.use(mongoSanitize());

app.use('/api/auth',      authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/holidays',  holidayRoutes);
app.use('/api/notes',     slotNoteRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'TNP Scheduler API is running!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
