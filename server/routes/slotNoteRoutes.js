// server/routes/slotNoteRoutes.js
import express from 'express';
import { getNotes, upsertNote } from '../controllers/slotNoteController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/',           protect,        getNotes);    // GET /api/notes
router.post('/',          protect, admin, upsertNote);  // POST /api/notes

export default router;
