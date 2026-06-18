import React, { useState, useEffect, useMemo } from 'react';
import {
  format, startOfMonth, endOfMonth, startOfWeek,
  endOfWeek, addDays, isSameMonth, isSameDay, differenceInCalendarDays
} from 'date-fns';
import '../styles/Dashboard.css';
import '../styles/Calendar.css';

// ─── SLOT COLORS ──────────────────────────────────────────────────────────────
const SLOT_COLORS = [
  { bg:'rgba(37,99,235,0.14)',  border:'rgba(37,99,235,0.40)',  text:'#93c5fd' },
  { bg:'rgba(5,150,105,0.14)',  border:'rgba(5,150,105,0.40)',  text:'#6ee7b7' },
  { bg:'rgba(124,58,237,0.14)', border:'rgba(124,58,237,0.40)', text:'#c4b5fd' },
  { bg:'rgba(217,119,6,0.14)',  border:'rgba(217,119,6,0.40)',  text:'#fcd34d' },
  { bg:'rgba(220,38,38,0.14)',  border:'rgba(220,38,38,0.40)',  text:'#fca5a5' },
];

const ROOM_CAPACITY = { Interview: 5, GD: 2, PPT: 1, OA: Infinity };

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const emptySlots   = () => ({ 1:[], 2:[], 3:[], 4:[], 5:[] });
const getSafeToken = () => { const t = localStorage.getItem('token'); return t ? t.replace(/"/g,'') : null; };
const fmtKey       = (d) => format(d, 'yyyy-MM-dd');
const buildLabel   = (c) => { const m = c.conductModes?.[0]||''; return m ? `${c.companyName} (${m})` : c.companyName; };
const getSlotCompanies = (slotValue) => Array.isArray(slotValue) ? slotValue : [];
const countFilledSlots = (daySlotMap) => [1,2,3,4,5].filter(n => getSlotCompanies(daySlotMap[n]).length > 0).length;
const getCompanySlotOccupants = (companies, date, slot, excludeId = null) => companies.filter(c =>
  c.schedule?.date === date &&
  String(c.schedule?.slot) === String(slot) &&
  c._id !== excludeId
);

const checkClientClash = (incoming, occupants) => {
  const clashes = [];

  for (const co of occupants) {
    const sharedBranches = incoming.eligibleBranches?.filter(b => co.eligibleBranches?.includes(b)) || [];
    const sharedModes = incoming.conductModes?.filter(m => co.conductModes?.includes(m)) || [];

    if (sharedBranches.length > 0 && sharedModes.length > 0) {
      clashes.push(`Branch+mode clash with "${co.companyName}": branches [${sharedBranches.join(', ')}], modes [${sharedModes.join(', ')}]`);
    }
  }

  for (const mode of incoming.conductModes || []) {
    const cap = ROOM_CAPACITY[mode] ?? 1;
    if (cap === Infinity) continue;
    const inUse = occupants.filter(co => co.conductModes?.includes(mode)).length;
    if (inUse >= cap) {
      clashes.push(`No ${mode} room available. Capacity ${cap} is already occupied.`);
    }
  }

  return clashes;
};

// ─── RECOMMENDATION ENGINE ────────────────────────────────────────────────────
//
// A smarter multi-factor urgency model:
//
// 1. PROXIMITY (primary driver)
//    Days away from today. Closest dates are most urgent.
//    Mapped on a soft exponential: prox = e^(-daysAway / 7)
//    → 0 days: 1.0 | 7 days: 0.37 | 14 days: 0.14 | 30 days: 0.013
//
// 2. CONGESTION BONUS
//    Dates that already have companies booked should be preferred
//    (consolidate rather than scatter) — but not if they're almost full.
//    bonus = filledSlots / 5  (0 → 0, 4 → 0.8, capped)
//
// 3. WEEKEND PENALTY
//    Saturdays and Sundays get a 40% penalty — most campus drives run weekdays.
//
// Final urgency = prox * (1 + 0.4 * congestionBonus) * weekdayFactor
//
// Thresholds (tuned empirically):
//   urgency >= 0.55  →  Aggressive  (0–5 days out)
//   urgency >= 0.18  →  Normal      (6–20 days out)
//   urgency <  0.18  →  Lenient     (>20 days)
//

const isWeekend = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
};

const computeUrgency = (dateStr, filledCount, today = new Date()) => {
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target   = new Date(dateStr + 'T00:00:00');
  const daysAway = Math.max(0, differenceInCalendarDays(target, todayMid));

  const proximity        = Math.exp(-daysAway / 7);
  const congestionBonus  = Math.min(filledCount, 4) / 5; // 0–0.8, never full
  const weekdayFactor    = isWeekend(dateStr) ? 0.6 : 1.0;

  const urgency = proximity * (1 + 0.4 * congestionBonus) * weekdayFactor;

  let label;
  if (urgency >= 0.55) {
    label   = 'Aggressive';
  } else if (urgency >= 0.18) {
    label   = 'Normal';
  } else {
    label   = 'Lenient';
  }

  return { label, urgency: Math.round(urgency * 1000) / 1000, daysAway };
};

// ─── COMPONENT ────────────────────────────────────────────────────────────────
const Calendar = ({ userRole }) => {
  const [currentDate, setCurrentDate]     = useState(new Date());
  const [rawCompanies, setRawCompanies]   = useState([]);
  const [holidays, setHolidays]           = useState({});
  const [isLoading, setIsLoading]         = useState(true);

  // Admin bar
  const [selDate, setSelDate]             = useState(null);
  const [tab, setTab]                     = useState('allot');
  const [allotSlot, setAllotSlot]         = useState('1');
  const [selCoId, setSelCoId]             = useState('');
  const [cancelCoId, setCancelCoId]       = useState('');
  const [updCoId, setUpdCoId]             = useState('');
  const [updNewSlot, setUpdNewSlot]       = useState('1');
  const [holName, setHolName]             = useState('');
  const [clashWarning, setClashWarning]   = useState(null);

  // Note panel
  const [noteTarget, setNoteTarget]       = useState(null);
  const [noteText, setNoteText]           = useState('');
  const [noteSaving, setNoteSaving]       = useState(false);

  // Detail popup
  const [detailCo, setDetailCo]           = useState(null);
  const [recCoId, setRecCoId]             = useState('');
  const [recUrgency, setRecUrgency]       = useState('Normal');

  const isAdmin = userRole === 'admin';

  // ── DERIVED DATA ─────────────────────────────────────────
  const slots = useMemo(() => {
    const s = {};
    rawCompanies.forEach(c => {
      if (c.schedule?.date && c.schedule?.slot) {
        const dk = c.schedule.date;
        const sn = Number(c.schedule.slot); // coerce — DB returns strings, keys are numbers
        if (!s[dk]) s[dk] = emptySlots();
        if (!Array.isArray(s[dk][sn])) s[dk][sn] = [];
        s[dk][sn].push({ id: c._id, display: buildLabel(c), company: c });
      }
    });
    return s;
  }, [rawCompanies]);

  const daySlots = (d) => slots[fmtKey(d)] || emptySlots();
  const holiday  = (d) => holidays[fmtKey(d)] || null;

  // ── FETCH ────────────────────────────────────────────────
  const fetchAll = async () => {
    try {
      const token = getSafeToken();
      if (!token) { setIsLoading(false); return; }
      const [cr, hr] = await Promise.all([
        fetch('http://localhost:5000/api/companies', { headers:{ Authorization:`Bearer ${token}` } }),
        fetch('http://localhost:5000/api/holidays',  { headers:{ Authorization:`Bearer ${token}` } }),
      ]);
      if (cr.status === 401) { setIsLoading(false); return; }
      setRawCompanies(cr.ok ? await cr.json() : []);
      const hd = hr.ok ? await hr.json() : [];
      const hm = {}; hd.forEach(h => { hm[h.date] = h.name; });
      setHolidays(hm);
    } catch(e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  // ── OPEN DATE ────────────────────────────────────────────
  const openDate = (d) => {
    if (!isAdmin) return;
    // Sundays: warn admin, let them decide
    if (d.getDay() === 0) {
      const proceed = window.confirm(
        `⚠️ ${format(d, 'MMMM d')} is a Sunday.\n\nSundays are typically non-working days. Do you still want to manage slots for this date?`
      );
      if (!proceed) return;
    }
    const s = daySlots(d);
    const ff = [1,2,3,4,5].find(n => getSlotCompanies(s[n]).length === 0) || 1;
    setAllotSlot(String(ff)); setSelCoId('');
    setCancelCoId(''); setUpdCoId(''); setUpdNewSlot('1');
    setHolName(holiday(d) || ''); setClashWarning(null);
    setTab(holiday(d) ? 'holiday' : 'allot');
    setSelDate(d);
  };
  const closeDate = () => { setSelDate(null); setClashWarning(null); };

  // ── API ──────────────────────────────────────────────────
  const apiPut = async (id, body) => {
    const token = getSafeToken();
    const res = await fetch(`http://localhost:5000/api/companies/${id}`, {
      method:'PUT',
      headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { const e = new Error(data.message); e.clashes = data.clashes; throw e; }
    return data;
  };

  // ── ALLOT ────────────────────────────────────────────────
  const doAllot = async () => {
    if (!selCoId) return alert('Select a company.');
    setClashWarning(null);
    try { await apiPut(selCoId, { schedule:{ date:fmtKey(selDate), slot:allotSlot } }); await fetchAll(); closeDate(); }
    catch(e) { if (e.clashes) setClashWarning(e.clashes); else alert(e.message); }
  };

  // ── UPDATE ───────────────────────────────────────────────
  const doUpdate = async () => {
    if (!updCoId) return alert('Select a company to move.');
    setClashWarning(null);
    try { await apiPut(updCoId, { schedule:{ date:fmtKey(selDate), slot:updNewSlot } }); await fetchAll(); closeDate(); }
    catch(e) { if (e.clashes) setClashWarning(e.clashes); else alert(e.message); }
  };

  // ── CANCEL ───────────────────────────────────────────────
  const doCancel = async () => {
    const co = rawCompanies.find(c => c._id === cancelCoId);
    if (!co) return alert('Select a scheduled company to cancel.');
    if (!window.confirm(`Cancel "${buildLabel(co)}"?`)) return;
    try { await apiPut(co._id, { schedule:{ date:null, slot:null, note:'' } }); await fetchAll(); closeDate(); }
    catch(e) { alert(e.message); }
  };

  // ── HOLIDAY ──────────────────────────────────────────────
  const doHoliday = async () => {
    if (!holName.trim()) return alert('Enter a holiday name.');
    const token = getSafeToken();
    const res = await fetch('http://localhost:5000/api/holidays', {
      method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
      body: JSON.stringify({ date:fmtKey(selDate), name:holName.trim() }),
    });
    if (res.ok) { await fetchAll(); closeDate(); } else { const d = await res.json(); alert(d.message); }
  };
  const doRemoveHoliday = async () => {
    const token = getSafeToken();
    const res = await fetch(`http://localhost:5000/api/holidays/${fmtKey(selDate)}`, { method:'DELETE', headers:{ Authorization:`Bearer ${token}` } });
    if (res.ok) { await fetchAll(); closeDate(); } else { const d = await res.json(); alert(d.message); }
  };

  // ── SAVE NOTE ────────────────────────────────────────────
  const saveNote = async () => {
    if (!noteTarget) return;
    setNoteSaving(true);
    try { await apiPut(noteTarget.companyId, { 'schedule.note': noteText.trim() }); await fetchAll(); setNoteTarget(null); }
    catch(e) { alert(e.message); }
    finally { setNoteSaving(false); }
  };

  // ── RECOMMENDATIONS ──────────────────────────────────────
  // Smarter: proximity + congestion consolidation + weekday preference
  const recommendations = useMemo(() => {
    const today = new Date();
    const targetCompany = rawCompanies.find(c => c._id === recCoId);

    if (!targetCompany) {
      return { Aggressive:[], Normal:[], Lenient:[] };
    }

    const urgencyWindows = {
      Aggressive: { start:1, end:10, preferred:3 },
      Normal:     { start:5, end:30, preferred:14 },
      Lenient:    { start:15, end:60, preferred:35 },
    };

    const selectedWindow = urgencyWindows[recUrgency] || urgencyWindows.Normal;
    const all = [];

    for (let i = selectedWindow.start; i <= selectedWindow.end; i++) {
      const d = addDays(today, i);
      const dk = fmtKey(d);
      if (holidays[dk]) continue;

      const s = slots[dk] || emptySlots();
      const filledSlots = countFilledSlots(s);
      const totalCompaniesOnDay = [1,2,3,4,5].reduce((sum, n) => sum + getSlotCompanies(s[n]).length, 0);

      for (const slotNum of [1,2,3,4,5]) {
        const occupants = getCompanySlotOccupants(rawCompanies, dk, slotNum, targetCompany._id);
        const clashes = checkClientClash(targetCompany, occupants);
        if (clashes.length > 0) continue;

        const slotLoad = occupants.length;
        const urgencyMeta = computeUrgency(dk, filledSlots, today);
        const daysFromPreferred = Math.abs(i - selectedWindow.preferred);
        const weekendPenalty = isWeekend(dk) ? 18 : 0;
        const emptyDayPenalty = totalCompaniesOnDay === 0 ? 8 : 0;
        const crowdedDayPenalty = totalCompaniesOnDay >= 7 ? 14 : 0;
        const coexistBonus = slotLoad > 0 ? 10 : 0;
        const spreadBonus = filledSlots < 4 ? 5 : 0;
        const score = 100 - daysFromPreferred * 3 - weekendPenalty - emptyDayPenalty - crowdedDayPenalty + coexistBonus + spreadBonus + urgencyMeta.urgency;

        all.push({
          date: dk,
          slot: slotNum,
          displayDate: format(d, 'EEE, MMM d'),
          daysAway: i,
          freeSlots: 5 - filledSlots,
          filledSlots,
          companiesOnDay: totalCompaniesOnDay,
          slotLoad,
          weekend: isWeekend(dk),
          score,
        });
      }
    }

    all.sort((a, b) => b.score - a.score);

    return {
      Aggressive: recUrgency === 'Aggressive' ? all.slice(0, 6) : [],
      Normal:     recUrgency === 'Normal' ? all.slice(0, 6) : [],
      Lenient:    recUrgency === 'Lenient' ? all.slice(0, 6) : [],
    };
  }, [rawCompanies, slots, holidays, recCoId, recUrgency]);

  // ── CALENDAR GRID ────────────────────────────────────────
  const monthStart = startOfMonth(currentDate);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn:1 });
  const gridEnd    = endOfWeek(endOfMonth(monthStart), { weekStartsOn:1 });

  const rows = [];
  let day = gridStart;
  while (day <= gridEnd) {
    const cells = [];
    for (let i = 0; i < 7; i++) {
      const d = day;
      const inMonth = isSameMonth(d, monthStart);
      const isToday = isSameDay(d, new Date());
      const hol = holiday(d);
      const s   = daySlots(d);
      const isSel = selDate && isSameDay(d, selDate);

      cells.push(
        <div key={d.toString()}
          className={['cal-cell', !inMonth?'disabled':'', isToday?'today':'', hol?'hol-cell':'', isSel?'selected-day':''].filter(Boolean).join(' ')}
          onClick={() => inMonth && openDate(d)}
        >
          <div className="cal-date-row">
            <span className={`cal-date${isToday?' today-dot':''}`}>{format(d,'d')}</span>
          </div>

          {hol ? (
            <div className="cal-hol-tag">🎉 {hol}</div>
          ) : (
            <div className="cal-slots">
              {[1,2,3,4,5].map(n => {
                const c = SLOT_COLORS[n-1];
                const slotCompanies = getSlotCompanies(s[n]);
                const hasCompanies = slotCompanies.length > 0;
                return (
                  <div key={n}
                    className={`cal-slot${hasCompanies?' cal-slot--filled cal-slot--stacked':' cal-slot--empty'}`}
                    style={{ background: hasCompanies?c.bg:'rgba(148,163,184,0.06)', border:`1px solid ${hasCompanies?c.border:'rgba(148,163,184,0.18)'}` }}
                    title={hasCompanies ? slotCompanies.map(slot => slot.display).join(', ') : `Slot ${n} - available`}
                  >
                    {hasCompanies ? (
                      slotCompanies.map(slot => (
                        <div
                          key={slot.id}
                          className="slot-company-line"
                          onClick={(e) => { e.stopPropagation(); setDetailCo(slot.company); }}
                        >
                          <span className="slot-filled" style={{ color:c.text }}>
                            {slot.display}
                          </span>
                          {isAdmin && (
                            <button className="slot-note-btn"
                              title={slot.company.schedule?.note ? 'Edit note' : 'Add note'}
                              onClick={(e) => { e.stopPropagation(); setNoteTarget({ companyId:slot.id, slot:n }); setNoteText(slot.company.schedule?.note||''); }}
                            >
                              {slot.company.schedule?.note ? 'N' : '+'}
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <span className="slot-empty">S{n}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
      day = addDays(day, 1);
    }
    rows.push(<div key={day.toString()} className="cal-row">{cells}</div>);
  }

  // ── ADMIN BAR ────────────────────────────────────────────
  const unscheduled    = rawCompanies.filter(c => !c.schedule?.date);
  const scheduledOnDay = selDate ? rawCompanies.filter(c => c.schedule?.date === fmtKey(selDate)) : [];

  return (
    <div className="calendar-page">

      {/* Page header */}
      <div className="cal-page-header">
        <h1 className="cal-page-title">Calendar</h1>
        <p className="cal-page-sub">
          {isAdmin ? 'Click a date to manage slots. Click any company pill to view details.' : 'Placement schedule — view only'}
        </p>
      </div>

      {/* Admin bar */}
      {isAdmin && (() => {
        if (!selDate) return (
          <div className="admin-control-bar admin-control-bar--hint">
            <p className="admin-hint-text">👆 Click any date to manage slots or declare holidays.</p>
          </div>
        );
        const s = daySlots(selDate), hol = holiday(selDate);
        return (
          <div className="admin-control-bar">
            <div className="control-group">
              <label>Mode — {format(selDate,'MMM d, yyyy')}</label>
              <select className="admin-select" value={tab} onChange={e=>{ setTab(e.target.value); setClashWarning(null); }}>
                <option value="allot">📌 Allot Slot</option>
                <option value="update">✏️ Update Slot</option>
                <option value="cancel">❌ Cancel Slot</option>
                <option value="holiday">🎉 Holiday</option>
              </select>
            </div>

            {tab==='allot' && (<>
              {hol ? <p className="admin-warn">⚠️ Holiday — remove first.</p> : <>
                <div className="control-group">
                  <label>Slot</label>
                  <select className="admin-select" value={allotSlot} onChange={e=>{ setAllotSlot(e.target.value); setClashWarning(null); }}>
                    {[1,2,3,4,5].map(n => {
                      const count = getSlotCompanies(s[n]).length;
                      return <option key={n} value={n}>Slot {n} {count ? `- ${count} booked` : '(Free)'}</option>;
                    })}
                  </select>
                </div>
                <div className="control-group">
                  <label>Company</label>
                  <select className="admin-select" value={selCoId} onChange={e=>{ setSelCoId(e.target.value); setClashWarning(null); }}>
                    <option value="">-- Select --</option>
                    {unscheduled.map(c=><option key={c._id} value={c._id}>{c.companyName}</option>)}
                  </select>
                </div>
                <button className="cal-action-btn cal-action-btn--primary" onClick={doAllot} disabled={!selCoId}>Allot</button>
              </>}
              <button className="cal-action-btn cal-action-btn--exit" onClick={closeDate}>Exit</button>
            </>)}

            {tab==='update' && (<>
              {hol ? <p className="admin-warn">⚠️ Holiday.</p> : <>
                <div className="control-group">
                  <label>Company to Move</label>
                  <select className="admin-select" value={updCoId} onChange={e=>{ setUpdCoId(e.target.value); setClashWarning(null); }}>
                    <option value="">-- Select --</option>
                    {scheduledOnDay.map(c=><option key={c._id} value={c._id}>{buildLabel(c)} → S{c.schedule.slot}</option>)}
                  </select>
                </div>
                <div className="control-group">
                  <label>Move to Slot</label>
                  <select className="admin-select" value={updNewSlot} onChange={e=>setUpdNewSlot(e.target.value)}>
                    {[1,2,3,4,5].map(n => {
                      const count = getSlotCompanies(s[n]).filter(slot => slot.id !== updCoId).length;
                      return <option key={n} value={n}>Slot {n} {count ? `- ${count} booked` : '(Free)'}</option>;
                    })}
                  </select>
                </div>
                <button className="cal-action-btn cal-action-btn--update" onClick={doUpdate} disabled={!updCoId}>Move</button>
              </>}
              <button className="cal-action-btn cal-action-btn--exit" onClick={closeDate}>Exit</button>
            </>)}

            {tab==='cancel' && (<>
              <div className="control-group">
                <label>Company to Cancel</label>
                <select className="admin-select" value={cancelCoId} onChange={e=>setCancelCoId(e.target.value)}>
                  <option value="">-- Select --</option>
                  {scheduledOnDay.map(c=><option key={c._id} value={c._id}>{buildLabel(c)} - Slot {c.schedule.slot}</option>)}
                </select>
              </div>
              <button className="cal-action-btn cal-action-btn--danger" onClick={doCancel} disabled={!cancelCoId}>Cancel</button>
              <button className="cal-action-btn cal-action-btn--exit" onClick={closeDate}>Exit</button>
            </>)}

            {tab==='holiday' && (<>
              <div className="control-group">
                <label>Holiday Name</label>
                <input className="admin-input" value={holName} onChange={e=>setHolName(e.target.value)} placeholder="e.g. Diwali" />
              </div>
              {hol
                ? <button className="cal-action-btn cal-action-btn--danger" onClick={doRemoveHoliday}>Remove</button>
                : <button className="cal-action-btn cal-action-btn--holiday" onClick={doHoliday}>Declare</button>}
              <button className="cal-action-btn cal-action-btn--exit" onClick={closeDate}>Exit</button>
            </>)}
          </div>
        );
      })()}

      {/* Clash warning */}
      {clashWarning && (
        <div className="clash-warning">
          <p className="clash-warning__title">⚠️ Clash Detected — slot not allotted</p>
          <ul className="clash-warning__list">
            {clashWarning.map((c,i) => <li key={i}>{c}</li>)}
          </ul>
          <button className="clash-warning__close" onClick={() => setClashWarning(null)}>Dismiss</button>
        </div>
      )}

      {/* Recommendation panel */}
      {isAdmin && (
        <div className="rec-panel">
          <p className="rec-panel__title">Slot Recommendations</p>
          <p className="rec-panel__sub">
            Select a company and urgency. Suggestions avoid holidays, branch/mode clashes, and room-capacity conflicts.
          </p>
          <div className="rec-controls">
            <select className="admin-select" value={recCoId} onChange={e => setRecCoId(e.target.value)}>
              <option value="">Select company</option>
              {rawCompanies.map(c => (
                <option key={c._id} value={c._id}>
                  {c.companyName}{c.schedule?.date ? ` - scheduled ${c.schedule.date}` : ''}
                </option>
              ))}
            </select>
            <select className="admin-select" value={recUrgency} onChange={e => setRecUrgency(e.target.value)}>
              <option value="Aggressive">Aggressive - sooner dates</option>
              <option value="Normal">Normal - balanced dates</option>
              <option value="Lenient">Lenient - flexible dates</option>
            </select>
          </div>
        </div>
      )}
      {(() => {
        const { Aggressive, Normal, Lenient } = recommendations;
        if (!Aggressive?.length && !Normal?.length && !Lenient?.length) return null;
        return (
          <div className="rec-panel">
            <p className="rec-panel__title">🎯 Slot Recommendations</p>
            <p className="rec-panel__sub">
              Dates ranked by proximity, schedule density, and weekday preference.
            </p>
            <div className="rec-grid">
              {[
                {
                  label: 'Aggressive',
                  color: '#ef4444',
                  bg:    'rgba(239,68,68,0.08)',
                  desc:  'Schedule immediately',
                  icon:  '🔴',
                  items: recommendations.Aggressive || [],
                },
                {
                  label: 'Normal',
                  color: '#f59e0b',
                  bg:    'rgba(245,158,11,0.08)',
                  desc:  'Good window to plan',
                  icon:  '🟡',
                  items: recommendations.Normal || [],
                },
                {
                  label: 'Lenient',
                  color: '#10b981',
                  bg:    'rgba(16,185,129,0.08)',
                  desc:  'No urgency yet',
                  icon:  '🟢',
                  items: recommendations.Lenient || [],
                },
              ].filter(col => col.label === recUrgency).map(col => (
                <div key={col.label} className="rec-col" style={{ background: col.bg, borderColor: col.color + '55' }}>
                  <p className="rec-col__label" style={{ color: col.color }}>{col.icon} {col.label}</p>
                  <p className="rec-col__desc">{col.desc}</p>
                  {col.items.length === 0
                    ? <p className="rec-col__empty">No dates in this range</p>
                    : col.items.map(r => (
                        <button
                          key={`${r.date}-${r.slot}`}
                          type="button"
                          className="rec-item rec-item--button"
                          onClick={() => {
                            const recommendedDate = new Date(r.date + 'T00:00:00');
                            setCurrentDate(recommendedDate);
                            setSelDate(recommendedDate);
                            setSelCoId(recCoId);
                            setAllotSlot(String(r.slot));
                            setTab('allot');
                          }}
                        >
                          <div>
                            <span className="rec-item__date">{r.displayDate} - Slot {r.slot}</span>
                            {r.weekend && <span className="rec-item__weekend"> · Weekend</span>}
                            {r.filledSlots > 0 && (
                              <span className="rec-item__density"> · {r.filledSlots} co. booked</span>
                            )}
                          </div>
                          <span className="rec-item__slots">score {Math.round(r.score)}</span>
                        </button>
                      ))
                  }
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Calendar grid */}
      <div className={`card calendar-card${isLoading?' cal-loading':''}`}>
        <div className="calendar-header-nav">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()-1, 1))}>&lt;</button>
          <h2 className="current-month">{format(currentDate,'MMMM yyyy')}</h2>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 1))}>&gt;</button>
        </div>
        <div className="days-row">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <div className="day-name" key={d}>{d}</div>)}
        </div>
        <div>{rows}</div>
      </div>

      {/* Note panel */}
      {noteTarget && (
        <div className="note-overlay" onClick={() => setNoteTarget(null)}>
          <div className="note-panel" onClick={e => e.stopPropagation()}>
            <div className="note-panel__header">
              <p className="note-panel__title">
                📝 Note — {rawCompanies.find(c=>c._id===noteTarget.companyId)?.companyName} · Slot {noteTarget.slot}
              </p>
              <button className="note-panel__close" onClick={() => setNoteTarget(null)}>✕</button>
            </div>
            <textarea className="note-panel__textarea" value={noteText} onChange={e => setNoteText(e.target.value)}
              placeholder="Write admin notes, reminders, special instructions..." rows={5} />
            <div className="note-panel__footer">
              <button className="cal-action-btn cal-action-btn--primary" onClick={saveNote} disabled={noteSaving}>
                {noteSaving ? 'Saving…' : 'Save Note'}
              </button>
              <button className="cal-action-btn cal-action-btn--exit" onClick={() => setNoteTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Company detail popup */}
      {detailCo && (() => {
        const c = detailCo;
        return (
          <div className="detail-overlay" onClick={() => setDetailCo(null)}>
            <div className="detail-popup" onClick={e => e.stopPropagation()}>
              <div className="detail-popup__header">
                <div>
                  <p className="detail-popup__name">{c.companyName}</p>
                  <p className="detail-popup__sub">{c.hiringType} · {c.schedule?.date} · Slot {c.schedule?.slot}</p>
                </div>
                <button className="note-panel__close" onClick={() => setDetailCo(null)}>✕</button>
              </div>
              <div className="detail-popup__body">
                <div className="detail-row"><span className="detail-label">CGPA Cutoff</span><span className="detail-value">{c.cgpaCutoff}+</span></div>
                <div className="detail-row"><span className="detail-label">Conduct Modes</span><span className="detail-value">{c.conductModes?.join(', ')}</span></div>
                <div className="detail-row"><span className="detail-label">Eligible Branches</span><span className="detail-value">{c.eligibleBranches?.join(', ')}</span></div>
                <div className="detail-row"><span className="detail-label">Eligible Batches</span><span className="detail-value">{c.eligibleBatches?.join(', ')}</span></div>
                <div className="detail-row"><span className="detail-label">Status</span><span className="detail-value">{c.status}</span></div>
                {c.schedule?.note && (
                  <div className="detail-note">
                    <span className="detail-label">Admin Note</span>
                    <p className="detail-note__text">{c.schedule.note}</p>
                  </div>
                )}
                <div className="detail-rooms">
                  <p className="detail-label" style={{ marginBottom:'8px' }}>Room Usage</p>
                  {c.conductModes?.map(m => {
                    const cap = ROOM_CAPACITY[m];
                    return (
                      <div key={m} className="detail-room-row">
                        <span className="detail-room-mode">{m}</span>
                        <span className="detail-room-cap">{cap===Infinity?'Online (unlimited)':`${cap} room${cap>1?'s':''}`}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default Calendar;
