import React, { useState } from 'react';
import './styles/global.css';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Companies from './pages/Companies';
import Calendar from './pages/Calendar';
import Profile from './pages/Profile';
import Sidebar from './components/Sidebar';

function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('companies');
  const [authView, setAuthView] = useState('login');

  if (!user) {
    if (authView === 'signup') {
      return (
        <>
          <div className="background-orbs">
            <div className="orb orb-1"></div>
            <div className="orb orb-2"></div>
            <div className="orb orb-3"></div>
          </div>
          <Signup
            onNavigateToLogin={() => setAuthView('login')}
            onSignup={(userData) => setUser(userData)}
          />
        </>
      );
    }

    return (
      <>
        <div className="background-orbs">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          <div className="orb orb-3"></div>
        </div>
        <Login
          onNavigateToSignup={() => setAuthView('signup')}
          onLogin={(userData) => setUser(userData)}
        />
      </>
    );
  }

  return (
    <div className="app-container">
      <div className="background-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      <Sidebar
        user={user}
        activePage={currentPage}
        setPage={setCurrentPage}
        onLogout={() => {
          localStorage.removeItem('token');
          setUser(null);
        }}
      />

      <main className="main-layout">
        <div className="content-area">
          {currentPage === 'companies' && (
            <Companies
              userRole={user.role}
              // "Allot Slot Now" button in Companies navigates here
              onNavigateToCalendar={() => setCurrentPage('calendar')}
            />
          )}
          {currentPage === 'calendar' && <Calendar userRole={user.role} />}
          {currentPage === 'profile' && (
            <Profile
              user={user}
              onLogout={() => {
                localStorage.removeItem('token');
                setUser(null);
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
