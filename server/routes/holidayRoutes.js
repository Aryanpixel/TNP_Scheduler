import express from 'express';
import { getHolidays, declareHoliday, removeHoliday } from '../controllers/holidayController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getHolidays)
  .post(protect, admin, declareHoliday);

// DELETE request to reverse the holiday by its date string
router.route('/:date')
  .delete(protect, admin, removeHoliday);

export default router;