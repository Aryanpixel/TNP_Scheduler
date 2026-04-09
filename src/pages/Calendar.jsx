import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay } from 'date-fns';
import '../styles/Dashboard.css';
import '../styles/Calendar.css';

const SLOT_COLORS = [
  { bg: 'rgba(37,99,235,0.10)',  border: 'rgba(37,99,235,0.25)',  text: '#1e40af' },
  { bg: 'rgba(5,150,105,0.10)',  border: 'rgba(5,150,105,0.25)',  text: '#065f46' },
  { bg: 'rgba(124,58,237,0.10)', border: 'rgba(124,58,237,0.25)', text: '#5b21b6' },
  { bg: 'rgba(217,119,6,0.10)',  border: 'rgba(217,119,6,0.25)',  text: '#92400e' },
  { bg: 'rgba(220,38,38,0.10)',  border: 'rgba(220,38,38,0.25)',  text: '#991b1b' },
];

const emptySlots = () => ({ 1: null, 2: null, 3: null, 4: null, 5: null });
const getSafeToken = () => { const t = localStorage.getItem('token'); return t ? t.replace(/"/g, '') : null; };
const buildLabel = (c) => { const m = c.conductModes?.[0] || ''; return m ? `${c.companyName} (${m})` : c.companyName; };

const Calendar = ({ userRole }) => {
  const [currentDate, setCurrentDate]     = useState(new Date());
  const [slots, setSlots]                 = useState({});
  const [rawCompanies, setRawCompanies]   = useState([]);
  const [holidays, setHolidays]           = useState({});
  const [modal, setModal]                 = useState(null);
  const [tab, setTab]                     = useState('allot');
  const [allotSlot, setAllotSlot]         = useState('1');
  const [selectedCoId, setSelectedCoId]   = useState('');
  const [cancelSlot, setCancelSlot]       = useState('1');
  const [updateCoId, setUpdateCoId]       = useState('');
  const [updateNewSlot, setUpdateNewSlot] = useState('1');
  const [holidayName, setHolidayName]     = useState('');
  const [isLoading, setIsLoading]         = useState(true);

  const isAdmin  = userRole === 'admin';
  const key      = (d) => format(d, 'yyyy-MM-dd');
  const daySlots = (d) => slots[key(d)] || emptySlots();
  const holiday  = (d) => holidays[key(d)] || null;

  const fetchAll = async () => {
    try {
      const token = getSafeToken();
      if (!token) { setIsLoading(false); return; }

      const [compRes, holRes] = await Promise.all([
        fetch('http://localhost:5000/api/companies', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('http://localhost:5000/api/holidays',  { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (compRes.status === 401) { setIsLoading(false); return; }

      const compData = compRes.ok ? await compRes.json() : [];
      const holData  = holRes.ok  ? await holRes.json()  : [];

      setRawCompanies(compData);
      const holMap = {};
      holData.forEach(h => { holMap[h.date] = h.name; });
      setHolidays(holMap);

      const mappedSlots = {};
      compData.forEach(c => {
        if (c.schedule?.date) {
          const dKey = c.schedule.date;
          const sNum = c.schedule.slot;
          if (!mappedSlots[dKey]) mappedSlots[dKey] = emptySlots();
          mappedSlots[dKey][sNum] = { id: c._id, display: buildLabel(c) };
        }
      });
      setSlots(mappedSlots);
    } catch (err) {
      console.error('Failed to sync calendar', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openModal = (day) => {
    if (!isAdmin) return;
    const s = daySlots(day);
    const firstFree = [1,2,3,4,5].find(n => !s[n]) || 1;
    setAllotSlot(String(firstFree));
    setSelectedCoId(''); setCancelSlot('1');
    setUpdateCoId(''); setUpdateNewSlot('1');
    setHolidayName(holiday(day) || '');
    setTab(holiday(day) ? 'holiday' : 'allot');
    setModal(day);
  };

  const closeModal = () => { setModal(null); setSelectedCoId(''); setHolidayName(''); };

  const apiPut = async (id, body) => {
    const token = getSafeToken();
    const res = await fetch(`http://localhost:5000/api/companies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    if (!res.ok) { const d = await res.json(); alert(d.message); return false; }
    return true;
  };

  const doAllot = async () => {
    if (!selectedCoId) return alert('Please select a company.');
    if (daySlots(modal)[allotSlot]) return alert('Slot already taken.');
    if (await apiPut(selectedCoId, { schedule: { date: key(modal), slot: allotSlot } })) {
      await fetchAll(); closeModal();
    }
  };

  const doUpdate = async () => {
    if (!updateCoId) return alert('Select a company to move.');
    if (daySlots(modal)[updateNewSlot]) return alert('Target slot is already occupied.');
    if (await apiPut(updateCoId, { schedule: { date: key(modal), slot: updateNewSlot } })) {
      await fetchAll(); closeModal();
    }
  };

  const doCancel = async () => {
    const co = daySlots(modal)[Number(cancelSlot)];
    if (!co) return alert('This slot is already empty.');
    if (!window.confirm(`Cancel allotment for "${co.display}"?`)) return;
    if (await apiPut(co.id, { schedule: { date: null, slot: null } })) {
      await fetchAll(); closeModal();
    }
  };

  const doHoliday = async () => {
    if (!holidayName.trim()) return alert('Enter a holiday name.');
    const token = getSafeToken();
    const res = await fetch('http://localhost:5000/api/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ date: key(modal), name: holidayName.trim() })
    });
    if (res.ok) { await fetchAll(); closeModal(); }
    else { const d = await res.json(); alert(d.message); }
  };

  const doRemoveHoliday = async () => {
    const token = getSafeToken();
    const res = await fetch(`http://localhost:5000/api/holidays/${key(modal)}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) { await fetchAll(); closeModal(); }
    else { const d = await res.json(); alert(d.message); }
  };

  // Calendar grid
  const monthStart = startOfMonth(currentDate);
  const rows = [];
  let day = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 });

  while (day <= endDate) {
    const cells = [];
    for (let i = 0; i < 7; i++) {
      const d = day;
      const inMonth    = isSameMonth(d, monthStart);
      const isToday    = isSameDay(d, new Date());
      const hol        = holiday(d);
      const s          = daySlots(d);
      const isSelected = modal && isSameDay(d, modal);
      cells.push(
        <div key={d.toString()}
          className={['cal-cell', !inMonth?'disabled':'', isToday?'today':'', hol?'hol-cell':'', isSelected?'selected-day':''].filter(Boolean).join(' ')}
          onClick={() => inMonth && openModal(d)}
        >
          <div className="cal-date-row">
            <span className={`cal-date ${isToday ? 'today-dot' : ''}`}>{format(d,'d')}</span>
          </div>
          {hol
            ? <div className="cal-hol-tag">🎉 {hol}</div>
            : <div className="cal-slots">
                {[1,2,3,4,5].map(n => {
                  const c = SLOT_COLORS[n-1];
                  return (
                    <div key={n} className="cal-slot" style={{
                      background: s[n] ? c.bg : 'rgba(148,163,184,0.06)',
                      border: `1px solid ${s[n] ? c.border : 'rgba(148,163,184,0.18)'}`
                    }}>
                      {s[n]
                        ? <span className="slot-filled" style={{ color: c.text }}>{s[n].display}</span>
                        : <span className="slot-empty">S{n}</span>}
                    </div>
                  );
                })}
              </div>
          }
        </div>
      );
      day = addDays(day, 1);
    }
    rows.push(<div key={day.toString()} className="cal-row">{cells}</div>);
  }

  // Admin bar
  const unscheduled    = rawCompanies.filter(c => !c.schedule?.date);
  const scheduledOnDay = modal ? rawCompanies.filter(c => c.schedule?.date === key(modal)) : [];

  const renderAdminBar = () => {
    if (!isAdmin) return null;
    if (!modal) {
      return (
        <div className="admin-control-bar admin-control-bar--hint">
          <p className="admin-hint-text">👆 Click any date to manage slots or declare holidays.</p>
        </div>
      );
    }

    const s   = daySlots(modal);
    const hol = holiday(modal);

    return (
      <div className="admin-control-bar">
        <div className="control-group">
          <label>Mode — {format(modal, 'MMM d, yyyy')}</label>
          <select className="admin-select" value={tab} onChange={e => setTab(e.target.value)}>
            <option value="allot">📌 Allot Slot</option>
            <option value="update">✏️ Update Slot</option>
            <option value="cancel">❌ Cancel Slot</option>
            <option value="holiday">🎉 Holiday</option>
          </select>
        </div>

        {tab === 'allot' && (<>
          {hol
            ? <p className="admin-warn">⚠️ Holiday declared. Remove it first to allot slots.</p>
            : <>
                <div className="control-group">
                  <label>Slot</label>
                  <select className="admin-select" value={allotSlot} onChange={e => setAllotSlot(e.target.value)}>
                    {[1,2,3,4,5].map(n => <option key={n} value={n} disabled={!!s[n]}>Slot {n} {s[n] ? `— Booked` : '(Free)'}</option>)}
                  </select>
                </div>
                <div className="control-group">
                  <label>Company</label>
                  <select className="admin-select" value={selectedCoId} onChange={e => setSelectedCoId(e.target.value)}>
                    <option value="">-- Select --</option>
                    {unscheduled.map(c => <option key={c._id} value={c._id}>{c.companyName}</option>)}
                  </select>
                </div>
                <button className="cal-action-btn cal-action-btn--primary" onClick={doAllot} disabled={!selectedCoId}>Allot</button>
              </>
          }
          <button className="cal-action-btn cal-action-btn--exit" onClick={closeModal}>Exit</button>
        </>)}

        {tab === 'update' && (<>
          {hol
            ? <p className="admin-warn">⚠️ This day is a holiday.</p>
            : <>
                <div className="control-group">
                  <label>Company to Move</label>
                  <select className="admin-select" value={updateCoId} onChange={e => setUpdateCoId(e.target.value)}>
                    <option value="">-- Select company --</option>
                    {scheduledOnDay.map(c => <option key={c._id} value={c._id}>{buildLabel(c)} → Slot {c.schedule.slot}</option>)}
                  </select>
                </div>
                <div className="control-group">
                  <label>Move to Slot</label>
                  <select className="admin-select" value={updateNewSlot} onChange={e => setUpdateNewSlot(e.target.value)}>
                    {[1,2,3,4,5].map(n => <option key={n} value={n} disabled={!!s[n]}>Slot {n} {s[n] ? '— Booked' : '(Free)'}</option>)}
                  </select>
                </div>
                <button className="cal-action-btn cal-action-btn--update" onClick={doUpdate} disabled={!updateCoId}>Move Slot</button>
              </>
          }
          <button className="cal-action-btn cal-action-btn--exit" onClick={closeModal}>Exit</button>
        </>)}

        {tab === 'cancel' && (<>
          <div className="control-group">
            <label>Slot to Cancel</label>
            <select className="admin-select" value={cancelSlot} onChange={e => setCancelSlot(e.target.value)}>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>Slot {n} {s[n] ? `— ${s[n].display}` : '(empty)'}</option>)}
            </select>
          </div>
          <button className="cal-action-btn cal-action-btn--danger" onClick={doCancel} disabled={!s[Number(cancelSlot)]}>Cancel Allotment</button>
          <button className="cal-action-btn cal-action-btn--exit" onClick={closeModal}>Exit</button>
        </>)}

        {tab === 'holiday' && (<>
          <div className="control-group">
            <label>Holiday Name</label>
            <input className="admin-input" value={holidayName} onChange={e => setHolidayName(e.target.value)} placeholder="e.g. Diwali, Republic Day" />
          </div>
          {hol
            ? <button className="cal-action-btn cal-action-btn--danger" onClick={doRemoveHoliday}>Remove Holiday</button>
            : <button className="cal-action-btn cal-action-btn--holiday" onClick={doHoliday}>Declare Holiday</button>
          }
          <button className="cal-action-btn cal-action-btn--exit" onClick={closeModal}>Exit</button>
        </>)}
      </div>
    );
  };

  return (
    <div className="calendar-page">
      <div className="cal-page-header">
        <h1 className="cal-page-title">Calendar</h1>
        <p className="cal-page-sub">
          {isAdmin ? 'Click a date to manage slots or declare holidays' : 'Placement schedule — view only'}
        </p>
      </div>

      {renderAdminBar()}

      <div className={`card calendar-card ${isLoading ? 'cal-loading' : ''}`}>
        <div className="calendar-header-nav">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()-1, 1))}>&lt;</button>
          <h2 className="current-month">{format(currentDate, 'MMMM yyyy')}</h2>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 1))}>&gt;</button>
        </div>
        <div className="days-row">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <div className="day-name" key={d}>{d}</div>)}
        </div>
        <div>{rows}</div>
      </div>
    </div>
  );
};

export default Calendar;
