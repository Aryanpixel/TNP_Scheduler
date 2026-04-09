import React from 'react';

const Sidebar = ({ user, activePage, setPage, onLogout }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="icon-box" style={{ width: '45px', height: '45px', lineHeight: '45px', fontSize: '1.5rem', marginBottom: '10px' }}>
          🎓
        </div>
        <h2 style={{ fontSize: '1.2rem', color: 'white', marginBottom: '4px' }}>TNP Portal</h2>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Admin Dashboard</p>
      </div>

      <nav className="sidebar-nav">
        <button 
          className={activePage === 'companies' ? 'active' : ''} 
          onClick={() => setPage('companies')}
        >
          🏢 Companies
        </button>
        <button 
          className={activePage === 'calendar' ? 'active' : ''} 
          onClick={() => setPage('calendar')}
        >
          📅 Calendar
        </button>
        <button 
          className={activePage === 'profile' ? 'active' : ''} 
          onClick={() => setPage('profile')}
        >
          👤 My Profile
        </button>
      </nav>

      <div className="sidebar-footer">
        <div style={{ marginBottom: '10px' }}>
          <p className="user-email" style={{ color: 'white', fontSize: '0.9rem' }}>{user?.email || 'user@college.edu'}</p>
          <p className="user-role" style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'capitalize' }}>Role: {user?.role || 'Admin'}</p>
        </div>
        <button className="logout-btn" onClick={onLogout}>
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;