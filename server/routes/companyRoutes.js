import express from 'express';
// We import the 3 controller functions here:
import { registerCompany, getCompanies, updateCompany } from '../controllers/companyController.js'; 
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Base route: /api/companies
router.route('/')
  .post(protect, admin, registerCompany)
  .get(protect, getCompanies);

// ID route: /api/companies/:id
router.route('/:id')
  .put(protect, admin, updateCompany);

export default router;