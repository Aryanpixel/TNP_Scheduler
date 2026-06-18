import React, { useMemo, useState } from 'react';
import '../styles/Dashboard.css';
import '../styles/Profile.css';

const Profile = ({ user, onLogout, theme = 'light', onThemeChange }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const initials = useMemo(() => {
    const email = user?.email || 'user@tnp.local';
    return email.slice(0, 2).toUpperCase();
  }, [user]);

  const handlePasswordUpdate = (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      alert('New passwords do not match.');
      return;
    }

    alert('Password updated successfully! (Mock)');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleDeleteAccount = () => {
    const isConfirmed = window.confirm(
      'This action is irreversible. Are you sure you want to permanently delete your account?'
    );

    if (isConfirmed) {
      alert('Account deleted.');
      onLogout();
    }
  };

  return (
    <div className="profile-page">
      <section className="profile-hero">
        <div className="profile-avatar">{initials}</div>

        <div className="profile-identity">
          <span className="profile-eyebrow">Account Control Center</span>
          <h1>My Profile</h1>
          <p>Manage account identity, access level, and security credentials.</p>
        </div>

        <div className="profile-role-card">
          <span>Role</span>
          <strong>{user.role?.toUpperCase()}</strong>
        </div>
      </section>

      <section className="profile-grid">
        <div className="profile-stack">
          <div className="profile-panel">
            <div className="profile-panel-head">
              <span>Identity</span>
              <h2>Account Details</h2>
            </div>

            <div className="profile-info-list">
              <div className="profile-info-row">
                <span>Email Address</span>
                <strong>{user.email}</strong>
              </div>

              <div className="profile-info-row">
                <span>System Role</span>
                <strong>{user.role?.toUpperCase()}</strong>
              </div>

              <div className="profile-info-row">
                <span>Access Status</span>
                <strong className="profile-status">Active</strong>
              </div>
            </div>
          </div>

          <div className="profile-panel">
            <div className="profile-panel-head">
              <span>Appearance</span>
              <h2>Theme Preference</h2>
            </div>

            <div className="profile-theme-switch" role="group" aria-label="Theme preference">
              <button
                type="button"
                className={theme === 'light' ? 'is-active' : ''}
                onClick={() => onThemeChange?.('light')}
              >
                Light
              </button>
              <button
                type="button"
                className={theme === 'dark' ? 'is-active' : ''}
                onClick={() => onThemeChange?.('dark')}
              >
                Dark
              </button>
            </div>

            <p className="profile-theme-copy">
              Your choice is saved on this browser and applied across the dashboard.
            </p>
          </div>

          <div className="profile-panel profile-panel--danger">
            <div className="profile-panel-head">
              <span>Critical</span>
              <h2>Danger Zone</h2>
            </div>

            <p className="profile-danger-copy">
              Account deletion removes local access immediately. Use this only when the account
              should no longer be part of the scheduling system.
            </p>

            <button className="profile-danger-btn" onClick={handleDeleteAccount}>
              Delete Account
            </button>
          </div>
        </div>

        <div className="profile-panel profile-security-panel">
          <div className="profile-panel-head">
            <span>Security</span>
            <h2>Update Password</h2>
          </div>

          <form className="profile-form" onSubmit={handlePasswordUpdate}>
            <label>
              <span>Current Password</span>
              <input
                type="password"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </label>

            <div className="profile-form-row">
              <label>
                <span>New Password</span>
                <input
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </label>

              <label>
                <span>Confirm Password</span>
                <input
                  type="password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </label>
            </div>

            <div className="profile-security-note">
              Passwords should be unique, private, and updated whenever access is shared or compromised.
            </div>

            <button type="submit" className="profile-primary-btn">
              Update Security Credentials
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

export default Profile;
