import React, { useState } from 'react';
import '../styles/Login.css';

const Signup = ({ onSignup, onNavigateToLogin }) => {
  const [role, setRole]         = useState('coordinator');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Registration failed.');
        return;
      }

      // Store token immediately so user is logged in after signup
      localStorage.setItem('token', data.token);

      onSignup({ email: data.email, role: data.role });

    } catch (err) {
      setError('Cannot connect to server. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-brand">
        <div className="icon-box">🎓</div>
        <h1>TNP Scheduler System</h1>
        <p>Create a New Account</p>
      </div>

      <div className="glass-card">
        <h2>Sign Up</h2>
        <p className="subtitle">Select your role and register</p>

        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <div className="role-selector">
          <button className={role === 'admin' ? 'active' : ''} onClick={() => setRole('admin')}>
            Admin
          </button>
          <button className={role === 'coordinator' ? 'active' : ''} onClick={() => setRole('coordinator')}>
            Coordinator
          </button>
        </div>

        <form onSubmit={handleSignup}>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="you@college.edu"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Create Password</label>
            <input
              type="password"
              placeholder="Min. 8 characters"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Creating account...' : `Create ${role.charAt(0).toUpperCase() + role.slice(1)} Account`}
          </button>
        </form>

        <p className="signup-link">
          Already have an account?{' '}
          <span onClick={onNavigateToLogin} style={{ color: '#2563eb', cursor: 'pointer', fontWeight: '500' }}>
            Sign in
          </span>
        </p>
      </div>
    </div>
  );
};

export default Signup;
