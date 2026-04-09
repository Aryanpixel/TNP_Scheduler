// server/models/Company.js
import mongoose from 'mongoose';

const companySchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true },
    eligibleBatches: [{ type: String }],
    eligibleBranches: [{ type: String }],
    cgpaCutoff: { type: Number, required: true },
    conductModes: [{ type: String }],
    hiringType: { type: String, required: true },
    schedule: {
      date: { type: String }, // e.g., "2026-04-05"
      slot: { type: String }  // e.g., "1"
    },
    status: {
      type: String,
      enum: ['Not Started', 'Active', 'Completed'],
      default: 'Not Started',
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    }
  },
  { timestamps: true }
);

export default mongoose.model('Company', companySchema);