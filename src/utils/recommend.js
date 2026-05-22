// src/utils/recommend.js
//
// ─── RECOMMENDATION ENGINE ───────────────────────────────────────────────────
//
//  Scoring formula:  score = e^(-(x + y))
//
//  Where:
//    x = days between today and the candidate slot date
//        (how far away is the slot? closer = higher urgency = more Aggressive)
//    y = number of slots already filled on that date
//        (more congestion = higher load = more Aggressive)
//
//  Since e^(-(x+y)) is a DECREASING function:
//    • Small x+y  →  score close to 1  →  AGGRESSIVE  (urgent / near / busy)
//    • Medium x+y →  score mid-range   →  NORMAL
//    • Large x+y  →  score close to 0  →  LENIENT     (far away / empty)
//
//  Thresholds (tuned to the x = days, y = filled slots scale):
//    score >= 0.55  →  AGGRESSIVE  (x ≤ ~3 days and few slots filled,
//                                   OR very close date regardless of congestion)
//    score >= 0.18  →  NORMAL      (x ≈ 4-15 days)
//    score <  0.18  →  LENIENT     (x > 15 days)
//
//  Why these thresholds?
//    e^(-(0+0))  = 1.00   → slot today, 0 filled   → extreme aggressive
//    e^(-(3+0))  = 0.050  → 3 days out, 0 filled
//    e^(-(3+2))  = 0.007  → hmm, too penalised?
//    Wait — we want CLOSER = MORE AGGRESSIVE, so we need to invert the
//    "close = small score" paradox.
//
//  CORRECTED FORMULA:
//    We want CLOSENESS to map to AGGRESSIVE.
//    So we flip: urgencyScore = e^(-x/5) * (1 + filledSlots/5)
//
//    urgencyScore is HIGH when x is small (close date) → AGGRESSIVE
//    urgencyScore drops as x grows → NORMAL → LENIENT
//
//  Final thresholds:
//    urgencyScore >= 0.6  → AGGRESSIVE  (0-3 days out)
//    urgencyScore >= 0.20 → NORMAL      (4-15 days out)
//    urgencyScore <  0.20 → LENIENT     (>15 days out)
//

export const RECOMMENDATION = {
  AGGRESSIVE: 'Aggressive',
  NORMAL:     'Normal',
  LENIENT:    'Lenient',
};

/**
 * computeUrgency
 *
 * @param {string} slotDate   - 'yyyy-MM-dd' — the candidate slot date
 * @param {number} filledSlots - how many of the 5 slots are already filled on that date
 * @param {Date}   [today]    - override for testing; defaults to new Date()
 *
 * @returns {{ label: string, score: number, daysAway: number }}
 */
export const computeUrgency = (slotDate, filledSlots = 0, today = new Date()) => {
  const target   = new Date(slotDate);
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const targetMid = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  const msPerDay = 1000 * 60 * 60 * 24;
  const x = Math.max(0, Math.round((targetMid - todayMid) / msPerDay)); // days away, ≥ 0
  const y = Math.min(filledSlots, 5); // cap at 5

  // urgencyScore: high when close (small x), boosted slightly when day is already busy (high y)
  // e^(-x/5) gives: x=0 → 1.0, x=5 → 0.37, x=10 → 0.14, x=15 → 0.05, x=20 → 0.018
  // (1 + y/5) boosts: y=0 → ×1.0, y=5 → ×2.0 — encourages use of already-busy days
  const score = Math.exp(-x / 5) * (1 + y / 5);

  let label;
  if (score >= 0.60) {
    label = RECOMMENDATION.AGGRESSIVE; // 0-3 days out (roughly)
  } else if (score >= 0.20) {
    label = RECOMMENDATION.NORMAL;     // ~4-12 days out
  } else {
    label = RECOMMENDATION.LENIENT;    // >12 days out
  }

  return { label, score: Math.round(score * 1000) / 1000, daysAway: x };
};

/**
 * getRecommendationColor
 * Returns a CSS color string for each recommendation tier.
 */
export const getRecommendationColor = (label) => {
  switch (label) {
    case RECOMMENDATION.AGGRESSIVE: return '#ef4444'; // red
    case RECOMMENDATION.NORMAL:     return '#f59e0b'; // amber
    case RECOMMENDATION.LENIENT:    return '#10b981'; // green
    default:                        return '#94a3b8';
  }
};

/**
 * getRecommendationBg
 * Returns a faint background for the badge.
 */
export const getRecommendationBg = (label) => {
  switch (label) {
    case RECOMMENDATION.AGGRESSIVE: return 'rgba(239,68,68,0.12)';
    case RECOMMENDATION.NORMAL:     return 'rgba(245,158,11,0.12)';
    case RECOMMENDATION.LENIENT:    return 'rgba(16,185,129,0.12)';
    default:                        return 'rgba(148,163,184,0.10)';
  }
};

/**
 * buildRecommendations
 *
 * Given the full list of companies and holidays, generates slot
 * recommendations for the next `lookaheadDays` days, one per (date, slot)
 * pair that is currently FREE and not a holiday.
 *
 * Returns an array sorted by urgencyScore DESC (most urgent first).
 *
 * @param {object[]} companies      - raw company list from API
 * @param {object}   holidays       - { 'yyyy-MM-dd': 'name' }
 * @param {number}   lookaheadDays  - how many days ahead to scan (default 30)
 * @param {Date}     [today]
 *
 * @returns {{ date, slot, daysAway, filledCount, label, score }[]}
 */
export const buildRecommendations = (
  companies,
  holidays      = {},
  lookaheadDays = 30,
  today         = new Date()
) => {
  // Build a map of how many slots are filled per date
  const filledPerDate = {};
  companies.forEach(c => {
    if (c.schedule?.date) {
      filledPerDate[c.schedule.date] = (filledPerDate[c.schedule.date] || 0) + 1;
    }
  });

  const results = [];
  const msPerDay = 1000 * 60 * 60 * 24;

  for (let i = 1; i <= lookaheadDays; i++) {
    const d    = new Date(today.getTime() + i * msPerDay);
    const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    if (holidays[dStr]) continue; // skip holidays

    const filled = filledPerDate[dStr] || 0;

    // Only suggest dates that still have at least one free slot
    if (filled >= 5) continue;

    // We recommend the date (not a specific slot) — let admin choose the slot
    const { label, score, daysAway } = computeUrgency(dStr, filled, today);

    results.push({ date: dStr, daysAway, filledCount: filled, freeSlots: 5 - filled, label, score });
  }

  // Sort most urgent first
  results.sort((a, b) => b.score - a.score);

  // Return top 10
  return results.slice(0, 10);
};
