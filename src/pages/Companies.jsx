import React, { useState, useEffect, useMemo } from 'react';
import {
  format, startOfMonth, endOfMonth, startOfWeek,
  endOfWeek, addDays, isSameMonth, isSameDay,
  subMonths, addMonths
} from 'date-fns';
import '../styles/Dashboard.css';
import '../styles/Companies.css';

const BATCH_OPTIONS   = ['Internship', 'BTech', 'MTech'];
const BRANCH_OPTIONS  = ['CSE', 'ECE', 'EEE', 'MEC', 'CME', 'CIV', 'MME', 'MIN'];
const CONDUCT_MODES   = ['OA', 'Interview', 'PPT', 'GD'];

// Mirrors the backend ROOM_CAPACITY
const ROOM_CAPACITY = { Interview: 5, GD: 2, PPT: 1, OA: Infinity };

const SLOT_COLORS = [
  { bg: 'rgba(37,99,235,0.18)',  border: 'rgba(37,99,235,0.50)',  text: '#93c5fd' },
  { bg: 'rgba(5,150,105,0.18)',  border: 'rgba(5,150,105,0.50)',  text: '#6ee7b7' },
  { bg: 'rgba(124,58,237,0.18)', border: 'rgba(124,58,237,0.50)', text: '#c4b5fd' },
  { bg: 'rgba(217,119,6,0.18)',  border: 'rgba(217,119,6,0.50)',  text: '#fcd34d' },
  { bg: 'rgba(220,38,38,0.18)',  border: 'rgba(220,38,38,0.50)',  text: '#fca5a5' },
];

const getSafeToken = () => { const t = localStorage.getItem('token'); return t ? t.replace(/"/g, '') : null; };
const fmtKey = (d) => format(d, 'yyyy-MM-dd');
const buildLabel = (c) => { const m = c.conductModes?.[0] || ''; return m ? `${c.companyName} (${m})` : c.companyName; };

// ─── CLIENT-SIDE CLASH CHECK (mirrors backend logic) ─────────────────────────
// Two companies clash only if they share BOTH a branch AND a mode.
// Room capacity is also checked independently.
const checkClientClash = (incoming, sameSlotList) => {
  const clashes = [];

  // Branch + mode clash
  for (const co of sameSlotList) {
    const sharedBranches = incoming.eligibleBranches.filter(b => co.eligibleBranches.includes(b));
    const sharedModes    = incoming.conductModes.filter(m => co.conductModes.includes(m));
    if (sharedBranches.length > 0 && sharedModes.length > 0) {
      clashes.push(`Branch+mode clash with "${co.companyName}": branches [${sharedBranches.join(', ')}], modes [${sharedModes.join(', ')}]`);
    }
  }

  // Room capacity
  for (const mode of incoming.conductModes) {
    const cap   = ROOM_CAPACITY[mode] ?? 1;
    if (cap === Infinity) continue;
    const inUse = sameSlotList.filter(co => co.conductModes.includes(mode)).length;
    if (inUse >= cap) {
      clashes.push(`No ${mode} room available (capacity ${cap}, all occupied)`);
    }
  }

  return clashes;
};

const Companies = ({ userRole }) => {
  const isAdmin = userRole === 'admin';

  // Form state
  const [companyName, setCompanyName]           = useState('');
  const [cgpa, setCgpa]                         = useState('');
  const [hiringType, setHiringType]             = useState('On Campus');
  const [selectedBatches, setSelectedBatches]   = useState([]);
  const [selectedBranches, setSelectedBranches] = useState([]);
  const [selectedModes, setSelectedModes]       = useState([]);

  // Rich calendar modal state
  const [calOpen, setCalOpen]                   = useState(false);
  const [calMonth, setCalMonth]                 = useState(new Date());
  const [activeCompanyId, setActiveCompanyId]   = useState(null);
  const [calSelDate, setCalSelDate]             = useState(null);   // Date object
  const [tempSlot, setTempSlot]                 = useState('1');
  const [allottedSchedule, setAllottedSchedule] = useState(null);
  const [calClash, setCalClash]                 = useState(null);   // clash warning in modal

  // Details modal
  const [detailCompany, setDetailCompany]       = useState(null);

  // Data & status
  const [loading, setLoading]                   = useState(false);
  const [isFetching, setIsFetching]             = useState(true);
  const [message, setMessage]                   = useState({ type: '', text: '' });
  const [companiesList, setCompaniesList]       = useState([]);
  const [holidays, setHolidays]                 = useState({});

  // ── FETCH ──────────────────────────────────────────
  const fetchAll = async () => {
    try {
      const token = getSafeToken();
      if (!token) return;
      const [compRes, holRes] = await Promise.all([
        fetch('http://localhost:5000/api/companies', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('http://localhost:5000/api/holidays',  { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (compRes.status === 401) { localStorage.removeItem('token'); window.location.reload(); return; }
      const compData = compRes.ok ? await compRes.json() : [];
      const holData  = holRes.ok  ? await holRes.json()  : [];
      setCompaniesList(compData);
      const holMap = {};
      holData.forEach(h => { holMap[h.date] = h.name; });
      setHolidays(holMap);
    } catch (err) {
      console.error('Failed to connect', err);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // ── SLOT MAP (date → slot# → company) ─────────────
  const slotMap = useMemo(() => {
    const s = {};
    companiesList.forEach(c => {
      if (c.schedule?.date && c.schedule?.slot) {
        if (!s[c.schedule.date]) s[c.schedule.date] = {};
        s[c.schedule.date][Number(c.schedule.slot)] = c; // coerce — DB returns string, keys are numbers
      }
    });
    return s;
  }, [companiesList]);

  const daySlots = (dateStr) => slotMap[dateStr] || {};

  const handleToggle = (item, list, setList) => {
    setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };

  // ── OPEN CALENDAR MODAL ────────────────────────────
  const openCalModal = (companyId) => {
    const co = companiesList.find(c => c._id === companyId);
    setActiveCompanyId(companyId || null);
    setCalSelDate(co?.schedule?.date ? new Date(co.schedule.date + 'T00:00:00') : null);
    setTempSlot(co?.schedule?.slot || '1');
    setCalClash(null);
    setCalOpen(true);
  };

  // ── DETERMINE SLOT AVAILABILITY LABEL ─────────────
  // For a given date + slot, check if the current active company can fit
  const getSlotStatus = (dateStr, slotNum, activeCoId) => {
    const occupants = Object.values(daySlots(dateStr)).filter(c =>
      String(c.schedule?.slot) === String(slotNum) && c._id !== activeCoId
    );
    if (occupants.length === 0) return 'free';

    // Check if the active company would clash
    if (!activeCoId) return occupants.length > 0 ? 'taken' : 'free';

    const activeCo = companiesList.find(c => c._id === activeCoId);
    if (!activeCo) return 'taken';

    // Use form state if no activeCo in list (new registration)
    const incoming = {
      eligibleBranches: activeCo.eligibleBranches || selectedBranches,
      conductModes:     activeCo.conductModes     || selectedModes,
    };
    const clashes = checkClientClash(incoming, occupants);
    return clashes.length > 0 ? 'clash' : 'coexist';
  };

  // ── CONFIRM SLOT SELECTION ─────────────────────────
  const confirmSlotSelection = async () => {
    if (!calSelDate) return alert('Select a date first.');
    const dateStr = fmtKey(calSelDate);

    if (holidays[dateStr]) {
      return alert(`⚠️ ${dateStr} is a holiday: "${holidays[dateStr]}". Choose a different date.`);
    }

    // Determine incoming company's profile
    const activeCo = activeCompanyId ? companiesList.find(c => c._id === activeCompanyId) : null;
    const incoming = {
      eligibleBranches: activeCo?.eligibleBranches || selectedBranches,
      conductModes:     activeCo?.conductModes     || selectedModes,
      companyName:      activeCo?.companyName      || companyName || 'New Company',
    };

    const occupants = Object.values(daySlots(dateStr)).filter(c =>
      String(c.schedule?.slot) === String(tempSlot) && c._id !== activeCompanyId
    );

    const clashes = checkClientClash(incoming, occupants);
    if (clashes.length > 0) {
      setCalClash(clashes);
      return;
    }

    if (activeCompanyId) {
      const token = getSafeToken();
      const res = await fetch(`http://localhost:5000/api/companies/${activeCompanyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ schedule: { date: dateStr, slot: tempSlot } })
      });
      if (res.ok) {
        await fetchAll();
        setCalOpen(false);
      } else {
        const d = await res.json();
        if (d.clashes) setCalClash(d.clashes);
        else alert(d.message);
      }
    } else {
      // Setting schedule for new registration
      setAllottedSchedule({ date: dateStr, slot: tempSlot });
      setCalOpen(false);
    }
  };

  // ── REGISTER ──────────────────────────────────────
  const handleRegisterCompany = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    if (selectedBatches.length === 0)  return setMessage({ type: 'error', text: 'Select at least one eligible batch.' });
    if (selectedBranches.length === 0) return setMessage({ type: 'error', text: 'Select at least one eligible branch.' });
    if (selectedModes.length === 0)    return setMessage({ type: 'error', text: 'Select at least one mode of conduct.' });

    setLoading(true);
    const payload = {
      companyName, eligibleBatches: selectedBatches,
      eligibleBranches: selectedBranches, cgpaCutoff: cgpa,
      conductModes: selectedModes, hiringType,
      schedule: allottedSchedule || { date: null, slot: null }
    };

    try {
      const token = getSafeToken();
      const res = await fetch('http://localhost:5000/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (res.status === 401) { localStorage.removeItem('token'); window.location.reload(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed.');
      await fetchAll();
      setMessage({ type: 'success', text: `${companyName} registered successfully!` });
      setCompanyName(''); setCgpa(''); setSelectedBatches([]);
      setSelectedBranches([]); setSelectedModes([]); setHiringType('On Campus'); setAllottedSchedule(null);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // ── RICH CALENDAR MODAL ────────────────────────────
  const RichCalendarModal = () => {
    if (!calOpen) return null;

    const monthStart = startOfMonth(calMonth);
    const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd    = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 });

    const rows = [];
    let day = gridStart;
    while (day <= gridEnd) {
      const cells = [];
      for (let i = 0; i < 7; i++) {
        const d       = day;
        const dateStr = fmtKey(d);
        const inMonth = isSameMonth(d, monthStart);
        const isToday = isSameDay(d, new Date());
        const isSel   = calSelDate && isSameDay(d, calSelDate);
        const hol     = holidays[dateStr];
        const slotsOnDay = daySlots(dateStr);

        cells.push(
          <div
            key={dateStr}
            onClick={() => { if (!inMonth || hol) return; setCalSelDate(d); setCalClash(null); }}
            className={[
              'rco-cell',
              !inMonth  ? 'rco-cell--out'      : '',
              isToday   ? 'rco-cell--today'    : '',
              hol       ? 'rco-cell--holiday'  : '',
              isSel     ? 'rco-cell--selected' : '',
              !inMonth || hol ? '' : 'rco-cell--clickable',
            ].filter(Boolean).join(' ')}
          >
            <div className="rco-date-row">
              <span className={`rco-date-num${isToday ? ' rco-date-today' : ''}`}>{format(d, 'd')}</span>
            </div>

            {hol ? (
              <div className="rco-hol-tag">🎉 {hol}</div>
            ) : (
              <div className="rco-slots">
                {[1, 2, 3, 4, 5].map(n => {
                  const c     = SLOT_COLORS[n - 1];
                  const occ   = slotsOnDay[n];
                  // Highlight the currently-selected slot on the selected date
                  const isTargetSlot = isSel && String(tempSlot) === String(n);

                  return (
                    <div
                      key={n}
                      className={`rco-slot${occ ? ' rco-slot--filled' : ' rco-slot--empty'}${isTargetSlot ? ' rco-slot--target' : ''}`}
                      style={{
                        background:   occ ? c.bg  : isTargetSlot ? 'rgba(59,130,246,0.18)' : 'rgba(148,163,184,0.06)',
                        border:       `1px solid ${occ ? c.border : isTargetSlot ? '#3b82f6' : 'rgba(148,163,184,0.18)'}`,
                      }}
                      title={occ ? `${occ.companyName} (${occ.conductModes?.join(', ')}) — ${occ.eligibleBranches?.join(', ')}` : `Slot ${n} — available`}
                    >
                      <span style={{ color: occ ? c.text : isTargetSlot ? '#93c5fd' : 'rgba(148,163,184,0.4)', fontSize: '0.62rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {occ ? buildLabel(occ) : `S${n}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(<div key={day.toString()} className="rco-row">{cells}</div>);
    }

    // Compute slot status preview for selected date
    const selDateStr = calSelDate ? fmtKey(calSelDate) : null;
    const slotStatuses = selDateStr ? [1,2,3,4,5].map(n => ({
      n,
      status: getSlotStatus(selDateStr, n, activeCompanyId),
      occ: daySlots(selDateStr)[n],
    })) : [];

    return (
      <div className="co-modal-overlay" onClick={() => { setCalOpen(false); setCalClash(null); }}>
        <div className="rco-modal" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="rco-modal-header">
            <div>
              <h2 className="rco-modal-title">Select Date &amp; Slot</h2>
              <p className="rco-modal-sub">Live view of all booked slots. Green slots can coexist; red means clash.</p>
            </div>
            <button className="co-cal-close" onClick={() => { setCalOpen(false); setCalClash(null); }}>✕</button>
          </div>

          {/* Nav */}
          <div className="rco-nav">
            <button onClick={() => setCalMonth(subMonths(calMonth, 1))}>← Prev</button>
            <span className="rco-month">{format(calMonth, 'MMMM yyyy')}</span>
            <button onClick={() => setCalMonth(addMonths(calMonth, 1))}>Next →</button>
          </div>

          {/* Day names */}
          <div className="rco-day-names">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <span key={d}>{d}</span>)}
          </div>

          {/* Grid */}
          <div className="rco-grid">{rows}</div>

          {/* Footer — slot picker + confirm */}
          <div className="rco-footer">
            {calClash && (
              <div className="rco-clash-box">
                <strong>⚠️ Clash detected:</strong>
                <ul>{calClash.map((c, i) => <li key={i}>{c}</li>)}</ul>
                <button onClick={() => setCalClash(null)}>Dismiss</button>
              </div>
            )}

            <div className="rco-footer-row">
              {selDateStr ? (
                <>
                  <div className="rco-slot-picker">
                    <label>Choose Slot for {format(calSelDate, 'MMM d, yyyy')}</label>
                    <div className="rco-slot-btns">
                      {slotStatuses.map(({ n, status, occ }) => {
                        const statusClass = {
                          free:    'rco-sb--free',
                          coexist: 'rco-sb--coexist',
                          clash:   'rco-sb--clash',
                          taken:   'rco-sb--clash',
                        }[status] || 'rco-sb--free';
                        const statusIcon = { free:'✓', coexist:'~', clash:'✗', taken:'✗' }[status];
                        return (
                          <button
                            key={n}
                            className={`rco-sb ${statusClass}${String(tempSlot) === String(n) ? ' rco-sb--active' : ''}`}
                            onClick={() => { setTempSlot(String(n)); setCalClash(null); }}
                            title={occ ? `Occupied by: ${occ.companyName} (${occ.conductModes?.join(', ')}) for ${occ.eligibleBranches?.join(', ')}` : 'Available'}
                          >
                            <span>S{n}</span>
                            <span className="rco-sb-icon">{statusIcon}</span>
                            {occ && <span className="rco-sb-occ">{occ.companyName.substring(0,6)}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <button className="btn-primary rco-confirm-btn" onClick={confirmSlotSelection}>
                    Confirm — {format(calSelDate, 'MMM d')} · Slot {tempSlot}
                  </button>
                </>
              ) : (
                <p className="rco-hint">👆 Click a date to select it, then choose a slot below.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── DETAILS MODAL ─────────────────────────────────
  const DetailsModal = () => {
    if (!detailCompany) return null;
    const c = detailCompany;
    return (
      <div className="co-modal-overlay" onClick={() => setDetailCompany(null)}>
        <div className="co-detail-modal" onClick={e => e.stopPropagation()}>
          <div className="co-detail-header">
            <div>
              <h2 className="co-detail-name">{c.companyName}</h2>
              <span className={`co-hiring-badge co-hiring-badge--${c.hiringType === 'On Campus' ? 'oncampus' : 'virtual'}`}>
                {c.hiringType}
              </span>
            </div>
            <button className="co-cal-close" onClick={() => setDetailCompany(null)}>✕</button>
          </div>
          <div className="co-detail-body">
            <div className="co-detail-row">
              <span className="co-detail-label">CGPA Cutoff</span>
              <span className="co-detail-value">{c.cgpaCutoff}+</span>
            </div>
            <div className="co-detail-row">
              <span className="co-detail-label">Schedule</span>
              <span className="co-detail-value">
                {c.schedule?.date
                  ? `${format(new Date(c.schedule.date), 'MMMM d, yyyy')} — Slot ${c.schedule.slot}`
                  : 'Not yet scheduled'}
              </span>
            </div>
            <div className="co-detail-row">
              <span className="co-detail-label">Status</span>
              <span className={`co-status-badge co-status-badge--${c.status?.toLowerCase().replace(' ', '-')}`}>{c.status}</span>
            </div>
            <div className="co-detail-section">
              <p className="co-detail-label">Eligible Batches</p>
              <div className="co-tag-row">{c.eligibleBatches.map(b => <span key={b} className="co-tag co-tag--batch">{b}</span>)}</div>
            </div>
            <div className="co-detail-section">
              <p className="co-detail-label">Eligible Branches</p>
              <div className="co-tag-row">{c.eligibleBranches.map(b => <span key={b} className="co-tag co-tag--branch">{b}</span>)}</div>
            </div>
            <div className="co-detail-section">
              <p className="co-detail-label">Mode of Conduct</p>
              <div className="co-tag-row">{c.conductModes.map(m => <span key={m} className="co-tag co-tag--mode">{m}</span>)}</div>
            </div>
            {c.addedBy?.email && (
              <div className="co-detail-row">
                <span className="co-detail-label">Added By</span>
                <span className="co-detail-value">{c.addedBy.email}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── RENDER ────────────────────────────────────────
  return (
    <div className="companies-page">
      <RichCalendarModal />
      <DetailsModal />

      <div className="co-page-header">
        <h1 className="co-page-title">Company Management</h1>
        <p className="co-page-sub">Register visiting recruiters into the system</p>
      </div>

      {message.text && (
        <div className={`co-message co-message--${message.type}`}>{message.text}</div>
      )}

      <div className="dashboard-grid">
        {isAdmin && (
          <div className="grid-column-form">
            <div className="card">
              <h3 className="co-card-title">Register New Company</h3>
              <form className="tnp-form" onSubmit={handleRegisterCompany}>
                <div className="form-group">
                  <label>Company Name</label>
                  <input type="text" required placeholder="e.g. Microsoft" value={companyName} onChange={e => setCompanyName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Eligible Batches</label>
                  <div className="co-chip-row">
                    {BATCH_OPTIONS.map(b => (
                      <label key={b} className={`co-chip ${selectedBatches.includes(b) ? 'co-chip--batch-active' : ''}`}>
                        <input type="checkbox" checked={selectedBatches.includes(b)} onChange={() => handleToggle(b, selectedBatches, setSelectedBatches)} className="co-chip-input" />
                        {b}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>Eligible Branches</label>
                  <div className="co-chip-row">
                    {BRANCH_OPTIONS.map(b => (
                      <label key={b} className={`co-chip ${selectedBranches.includes(b) ? 'co-chip--branch-active' : ''}`}>
                        <input type="checkbox" checked={selectedBranches.includes(b)} onChange={() => handleToggle(b, selectedBranches, setSelectedBranches)} className="co-chip-input" />
                        {b}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>CGPA Cutoff</label>
                    <input type="number" step="0.1" min="0" max="10" required placeholder="e.g. 7.5" value={cgpa} onChange={e => setCgpa(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Type of Hiring</label>
                    <select value={hiringType} onChange={e => setHiringType(e.target.value)}>
                      <option value="On Campus">On Campus</option>
                      <option value="Virtual">Virtual</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Mode of Conduct</label>
                  <div className="co-chip-row">
                    {CONDUCT_MODES.map(m => (
                      <label key={m} className={`co-chip ${selectedModes.includes(m) ? 'co-chip--mode-active' : ''}`}>
                        <input type="checkbox" checked={selectedModes.includes(m)} onChange={() => handleToggle(m, selectedModes, setSelectedModes)} className="co-chip-input" />
                        {m}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="co-schedule-box">
                  <div>
                    <span className="co-schedule-label">Assigned Schedule (Optional)</span>
                    {allottedSchedule
                      ? <span className="co-schedule-value">{format(new Date(allottedSchedule.date), 'MMMM d, yyyy')} — Slot {allottedSchedule.slot}</span>
                      : <span className="co-schedule-empty">Will be decided later</span>
                    }
                  </div>
                  <button type="button" className="co-open-cal-btn" onClick={() => { setActiveCompanyId(null); setCalSelDate(null); setCalOpen(true); }}>
                    {allottedSchedule ? 'Change Slot' : 'Open Calendar'}
                  </button>
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Registering...' : 'Register Company'}
                </button>
              </form>
            </div>
          </div>
        )}

        <div className={isAdmin ? 'grid-column-table' : 'grid-column-full'}>
          <div className="card">
            <h3 className="co-card-title">Registered Companies</h3>
            {isFetching ? (
              <p className="co-state-text">Loading database...</p>
            ) : companiesList.length === 0 ? (
              <p className="co-state-text">No companies registered yet.</p>
            ) : (
              <div className="co-table-wrap">
                <table className="tnp-table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Hiring Type</th>
                      <th>Conduct Mode</th>
                      <th>Schedule</th>
                      <th>Status</th>
                      <th>Details</th>
                      {isAdmin && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {companiesList.map(comp => (
                      <tr key={comp._id}>
                        <td className="co-td-name">{comp.companyName}</td>
                        <td>
                          <span className={`co-hiring-badge co-hiring-badge--${comp.hiringType === 'On Campus' ? 'oncampus' : 'virtual'}`}>
                            {comp.hiringType}
                          </span>
                        </td>
                        <td>
                          <div className="co-tag-row">
                            {comp.conductModes.map(m => <span key={m} className="co-tag co-tag--mode">{m}</span>)}
                          </div>
                        </td>
                        <td>
                          {comp.schedule?.date
                            ? <span className="co-sched-filled">{format(new Date(comp.schedule.date), 'MMM d')}<br />Slot {comp.schedule.slot}</span>
                            : <span className="co-sched-empty">No slot</span>
                          }
                        </td>
                        <td>
                          <span className={`co-status-badge co-status-badge--${comp.status?.toLowerCase().replace(' ', '-')}`}>{comp.status}</span>
                        </td>
                        <td>
                          <button className="co-btn co-btn--details" onClick={() => setDetailCompany(comp)}>See Details</button>
                        </td>
                        {isAdmin && (
                          <td>
                            <button
                              className={`co-btn ${comp.schedule?.date ? 'co-btn--reassign' : 'co-btn--allot'}`}
                              onClick={() => openCalModal(comp._id)}
                            >
                              {comp.schedule?.date ? '✏️ Reassign' : '📅 Allot Slot'}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Companies;
