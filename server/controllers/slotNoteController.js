// server/controllers/slotNoteController.js
import SlotNote from '../models/SlotNote.js';

// GET /api/notes  — fetch all notes (optionally filter by ?date=yyyy-MM-dd)
export const getNotes = async (req, res) => {
  try {
    const filter = req.query.date ? { date: req.query.date } : {};
    const notes  = await SlotNote.find(filter).populate('addedBy', 'email');
    res.status(200).json(notes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/notes  — create or update a note for a date+slot
export const upsertNote = async (req, res) => {
  try {
    const { date, slot, note } = req.body;
    if (!date || !slot || !note?.trim()) {
      return res.status(400).json({ message: 'date, slot and note are required.' });
    }

    const saved = await SlotNote.findOneAndUpdate(
      { date, slot },
      { note: note.trim(), addedBy: req.user._id },
      { upsert: true, returnDocument: 'after', runValidators: false }
    );
    res.status(200).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
