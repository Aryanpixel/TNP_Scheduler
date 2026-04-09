import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true }, // Format: "YYYY-MM-DD"
  name: { type: String, required: true }
}, { timestamps: true });

export default mongoose.model('Holiday', holidaySchema);