import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, subMonths, addMonths } from 'date-fns';
import '../styles/Dashboard.css';
import '../styles/Companies.css';

const BATCH_OPTIONS   = ['Internship', 'BTech', 'MTech'];
const BRANCH_OPTIONS  = ['CSE', 'ECE', 'EEE', 'MEC', 'CME', 'CIV', 'MME', 'MIN'];
const CONDUCT_MODES   = ['OA', 'Interview', 'PPT', 'GD'];

const getSafeToken = () => { const t = localStorage.getItem('token'); return t ? t.replace(/"/g, '') : null; };

const Companies = ({ userRole }) => {
  const isAdmin = userRole === 'admin';

  // Form state
  const [companyName, setCompanyName]         = useState('');
  const [cgpa, setCgpa]                       = useState('');
  const [hiringType, setHiringType]           = useState('On Campus');
  const [selectedBatches, setSelectedBatches] = useState([]);
  const [selectedBranches, setSelectedBranches] = useState([]);
  const [selectedModes, setSelectedModes]     = useState([]);

  // Calendar modal state
  const [calOpen, setCalOpen]                 = useState(false);
  const [calMonth, setCalMonth]               = useState(new Date());
  const [activeCompanyId, setActiveCompanyId] = useState(null);
  const [tempDate, setTempDate]               = useState(format(new Date(), 'yyyy-MM-dd'));
  const [tempSlot, setTempSlot]               = useState('1');
  const [allottedSchedule, setAllottedSchedule] = useState(null);

  // Details modal state
  const [detailCompany, setDetailCompany]     = useState(null);

  // Data & status
  const [loading, setLoading]                 = useState(false);
  const [isFetching, setIsFetching]           = useState(true);
  const [message, setMessage]                 = useState({ type: '', text: '' });
  const [companiesList, setCompaniesList]     = useState([]);
  const [holidays, setHolidays]               = useState({}); // { 'yyyy-MM-dd': 'name' }

  // ── FETCH ────────────────────────────────────────
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

  const handleToggle = (item, list, setList) => {
    setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };

  // ── REGISTER ─────────────────────────────────────
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

  // ── ALLOT SLOT FROM COMPANIES TABLE ──────────────
  const confirmSlotSelection = async () => {
    if (!tempDate) return alert('Select a date.');

    // Block if it's a holiday
    if (holidays[tempDate]) {
      return alert(`⚠️ ${tempDate} is declared as "${holidays[tempDate]}". Choose a different date.`);
    }

    // Check if slot on that date is already taken by another company
    const conflict = companiesList.find(c =>
      c.schedule?.date === tempDate &&
      String(c.schedule?.slot) === String(tempSlot) &&
      c._id !== activeCompanyId
    );
    if (conflict) return alert(`Slot ${tempSlot} on this date is already taken by ${conflict.companyName}.`);

    if (activeCompanyId) {
      // Updating an existing company's slot
      const token = getSafeToken();
      const res = await fetch(`http://localhost:5000/api/companies/${activeCompanyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ schedule: { date: tempDate, slot: tempSlot } })
      });
      if (res.ok) { await fetchAll(); setCalOpen(false); }
      else { const d = await res.json(); alert(d.message); }
    } else {
      // Setting schedule for the new registration form
      setAllottedSchedule({ date: tempDate, slot: tempSlot });
      setCalOpen(false);
    }
  };

  // ── CALENDAR MODAL ────────────────────────────────
  const CalendarModal = () => {
    if (!calOpen) return null;

    const monthStart = startOfMonth(calMonth);
    const startDate  = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate    = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 });
    const days = [];
    let d = startDate;
    while (d <= endDate) { days.push(d); d = addDays(d, 1); }

    return (
      <div className="co-modal-overlay" onClick={() => setCalOpen(false)}>
        <div className="co-cal-modal" onClick={e => e.stopPropagation()}>
          <div className="co-cal-header">
            <div>
              <h2 className="co-cal-title">Select Date & Slot</h2>
              <p className="co-cal-sub">Holidays are highlighted and blocked.</p>
            </div>
            <button className="co-cal-close" onClick={() => setCalOpen(false)}>✕</button>
          </div>

          <div className="co-cal-nav">
            <button onClick={() => setCalMonth(subMonths(calMonth, 1))}>← Prev</button>
            <span className="co-cal-month">{format(calMonth, 'MMMM yyyy')}</span>
            <button onClick={() => setCalMonth(addMonths(calMonth, 1))}>Next →</button>
          </div>

          <div className="co-cal-grid-head">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <span key={d}>{d}</span>)}
          </div>

          <div className="co-cal-grid">
            {days.map(d => {
              const dateStr    = format(d, 'yyyy-MM-dd');
              const isSelected = tempDate === dateStr;
              const inMonth    = isSameMonth(d, calMonth);
              const isHoliday  = !!holidays[dateStr];
              return (
                <div
                  key={dateStr}
                  onClick={() => !isHoliday && setTempDate(dateStr)}
                  className={[
                    'co-cal-day',
                    isSelected ? 'selected' : '',
                    !inMonth   ? 'out-month' : '',
                    isHoliday  ? 'is-holiday' : '',
                  ].filter(Boolean).join(' ')}
                  title={isHoliday ? `Holiday: ${holidays[dateStr]}` : ''}
                >
                  {format(d, 'd')}
                  {isHoliday && <span className="co-hol-dot" />}
                </div>
              );
            })}
          </div>

          <div className="co-cal-footer">
            <div className="co-cal-slot-row">
              <label>Assign Slot</label>
              <select value={tempSlot} onChange={e => setTempSlot(e.target.value)}>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>Slot {n}</option>)}
              </select>
            </div>
            <button className="btn-primary co-confirm-btn" onClick={confirmSlotSelection}>Confirm Schedule</button>
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
              <span className={`co-status-badge co-status-badge--${c.status?.toLowerCase().replace(' ','-')}`}>{c.status}</span>
            </div>
            <div className="co-detail-section">
              <p className="co-detail-label">Eligible Batches</p>
              <div className="co-tag-row">
                {c.eligibleBatches.map(b => <span key={b} className="co-tag co-tag--batch">{b}</span>)}
              </div>
            </div>
            <div className="co-detail-section">
              <p className="co-detail-label">Eligible Branches</p>
              <div className="co-tag-row">
                {c.eligibleBranches.map(b => <span key={b} className="co-tag co-tag--branch">{b}</span>)}
              </div>
            </div>
            <div className="co-detail-section">
              <p className="co-detail-label">Mode of Conduct</p>
              <div className="co-tag-row">
                {c.conductModes.map(m => <span key={m} className="co-tag co-tag--mode">{m}</span>)}
              </div>
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
      <CalendarModal />
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
                  <button type="button" className="co-open-cal-btn" onClick={() => { setActiveCompanyId(null); setCalOpen(true); }}>
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
                          <span className={`co-status-badge co-status-badge--${comp.status?.toLowerCase().replace(' ','-')}`}>{comp.status}</span>
                        </td>
                        <td>
                          <button className="co-btn co-btn--details" onClick={() => setDetailCompany(comp)}>
                            See Details
                          </button>
                        </td>
                        {isAdmin && (
                          <td>
                            <button
                              className={`co-btn ${comp.schedule?.date ? 'co-btn--reassign' : 'co-btn--allot'}`}
                              onClick={() => { setActiveCompanyId(comp._id); setTempDate(comp.schedule?.date || format(new Date(),'yyyy-MM-dd')); setTempSlot(comp.schedule?.slot || '1'); setCalOpen(true); }}
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
