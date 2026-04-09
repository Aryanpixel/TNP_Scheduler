import React, { useState } from 'react';
import '../styles/Login.css';

const Login = ({ onLogin, onNavigateToSignup }) => {
  const [role, setRole]         = useState('admin');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Login failed. Check your credentials.');
        return;
      }

      // Store token so Companies.jsx and Calendar.jsx can use it
      localStorage.setItem('token', data.token);

      // Pass user info up to App.jsx
      onLogin({ email: data.email, role: data.role });

    } catch (err) {
      setError('Cannot connect to server. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-container">

        <div className="login-brand">
          <div className="icon-box">🎓</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '5px' }}>TNP Scheduler</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Training & Placement Cell</p>
        </div>

        <div className="glass-card">
          <h2 style={{ marginBottom: '0.5rem' }}>Sign In</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Enter your credentials to continue</p>

          {error && (
            <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '500' }}>Email Address</label>
            <input
              type="email"
              className="login-input"
              placeholder="you@college.edu"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '5px', fontWeight: '500' }}>Password</label>
            <input
              type="password"
              className="login-input"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Don't have an account?{' '}
            <span onClick={onNavigateToSignup} style={{ color: 'var(--primary-blue)', cursor: 'pointer', fontWeight: '600' }}>
              Sign up
            </span>
          </p>
        </div>

      </div>
    </div>
  );
};

export default Login;
