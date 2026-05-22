// server/routes/companyRoutes.js
import express from 'express';
import { registerCompany, getCompanies, updateCompany, checkSlot } from '../controllers/companyController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Must be before /:id to avoid Express treating "check-slot" as an :id param
router.post('/check-slot', protect, admin, checkSlot);

router.route('/').post(protect, admin, registerCompany).get(protect, getCompanies);
router.route('/:id').put(protect, admin, updateCompany);

export default router;
