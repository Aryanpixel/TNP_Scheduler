// server/models/SlotNote.js
import mongoose from 'mongoose';

const slotNoteSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // 'yyyy-MM-dd'
    slot: { type: String, required: true }, // '1' - '5'
    note: { type: String, required: true, trim: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

// One note per date+slot (upsert pattern)
slotNoteSchema.index({ date: 1, slot: 1 }, { unique: true });

export default mongoose.model('SlotNote', slotNoteSchema);
