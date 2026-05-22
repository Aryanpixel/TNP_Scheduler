// server/controllers/companyController.js
import Company from '../models/Company.js';

// ─── ROOM CAPACITIES ──────────────────────────────────────────────────────────
// How many companies can run each mode simultaneously in the same slot.
// OA is online → unlimited.
const ROOM_CAPACITY = {
  Interview: 5,
  GD:        2,
  PPT:       1,
  OA:        Infinity,
};

// ─── CLASH DETECTION ─────────────────────────────────────────────────────────
/**
 * Branch + mode clash:
 * Two companies clash only if they share BOTH at least one branch AND
 * at least one mode. If Microsoft does GD for Chemical and Google does
 * Interview for CSE — no shared branch → no clash.
 */
const detectBranchModeClash = (incoming, existing) => {
  const clashes = [];
  for (const co of existing) {
    const sharedBranches = incoming.eligibleBranches.filter(b => co.eligibleBranches.includes(b));
    const sharedModes    = incoming.conductModes.filter(m => co.conductModes.includes(m));
    if (sharedBranches.length > 0 && sharedModes.length > 0) {
      clashes.push(
        `Branch+mode clash with "${co.companyName}": ` +
        `branches [${sharedBranches.join(', ')}], modes [${sharedModes.join(', ')}]`
      );
    }
  }
  return clashes;
};

/**
 * Room capacity check — independent of branch overlap.
 * If all GD rooms are taken, no more GD regardless of which branches.
 */
const detectRoomClash = (incoming, existing) => {
  const issues = [];
  for (const mode of incoming.conductModes) {
    const cap   = ROOM_CAPACITY[mode] ?? 1;
    if (cap === Infinity) continue;
    const inUse = existing.filter(co => co.conductModes.includes(mode)).length;
    if (inUse >= cap) {
      issues.push(`No ${mode} room available (capacity ${cap}, all occupied)`);
    }
  }
  return issues;
};

// ─── REGISTER ─────────────────────────────────────────────────────────────────
export const registerCompany = async (req, res) => {
  try {
    const company = await Company.create({ ...req.body, addedBy: req.user._id });
    res.status(201).json(company);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ─── GET ALL ──────────────────────────────────────────────────────────────────
export const getCompanies = async (req, res) => {
  try {
    const companies = await Company.find({})
      .sort({ createdAt: -1 })
      .populate('addedBy', 'email');
    res.status(200).json(companies);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// ─── UPDATE (slot / note / status) ───────────────────────────────────────────
export const updateCompany = async (req, res) => {
  try {
    const incoming = await Company.findById(req.params.id);
    if (!incoming) return res.status(404).json({ message: 'Company not found' });

    // Only run clash check when actually allotting a new date+slot
    if (req.body.schedule?.date && req.body.schedule?.slot) {
      const sameSlot = await Company.find({
        _id:             { $ne: req.params.id },
        'schedule.date': req.body.schedule.date,
        'schedule.slot': req.body.schedule.slot,
      });

      const incomingData = {
        companyName:      incoming.companyName,
        eligibleBranches: req.body.eligibleBranches || incoming.eligibleBranches,
        conductModes:     req.body.conductModes     || incoming.conductModes,
      };

      const branchModeClashes = detectBranchModeClash(incomingData, sameSlot);
      const roomClashes       = detectRoomClash(incomingData, sameSlot);
      const all               = [...branchModeClashes, ...roomClashes];

      if (all.length > 0) {
        return res.status(409).json({ message: 'Clash detected.', clashes: all });
      }
    }

    const updated = await Company.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: false }
    );
    res.status(200).json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ─── CHECK SLOT (preview clashes before confirming) ──────────────────────────
// POST /api/companies/check-slot
// Body: { companyId, date, slot }
export const checkSlot = async (req, res) => {
  try {
    const { companyId, date, slot } = req.body;
    const incoming = await Company.findById(companyId);
    if (!incoming) return res.status(404).json({ message: 'Company not found' });

    const sameSlot = await Company.find({
      _id:             { $ne: companyId },
      'schedule.date': date,
      'schedule.slot': slot,
    });

    const branchModeClashes = detectBranchModeClash(incoming, sameSlot);
    const roomClashes       = detectRoomClash(incoming, sameSlot);

    res.status(200).json({
      safe:       branchModeClashes.length === 0 && roomClashes.length === 0,
      branchModeClashes,
      roomClashes,
      coexisting: sameSlot.map(c => ({
        name:     c.companyName,
        branches: c.eligibleBranches,
        modes:    c.conductModes,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
