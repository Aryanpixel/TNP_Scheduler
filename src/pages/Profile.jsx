import React, { useState } from 'react';
import '../styles/Dashboard.css';

const Profile = ({ user, onLogout }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handlePasswordUpdate = (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert("New passwords do not match!");
      return;
    }
    // Pro-Tip: In a production environment, this payload MUST be sent over HTTPS 
    // to your backend, where the current password is verified against a hashed DB entry.
    console.log("Password update requested for:", user.email);
    alert("Password updated successfully! (Mock)");
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleDeleteAccount = () => {
    const isConfirmed = window.confirm(
      "WARNING: This action is irreversible. Are you sure you want to permanently delete your account?"
    );
    
    if (isConfirmed) {
      console.log("Deleting account:", user.email);
      // Logic: Send DELETE request to API, then log the user out on the client side.
      alert("Account deleted.");
      onLogout(); 
    }
  };

  return (
    <div className="profile-page">
      <div className="calendar-top-header">
        <div>
          <h1 style={{ color: '#1e293b', fontSize: '2rem', marginBottom: '8px' }}>My Profile</h1>
          <p style={{ color: '#64748b' }}>Manage your account settings and credentials</p>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Left Column: Profile Info & Danger Zone */}
        <div className="grid-column-form" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="card">
            <h3 style={{ marginBottom: '20px', color: '#1e293b' }}>Account Details</h3>
            <div className="tnp-form">
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>Email Address</label>
                <input type="email" value={user.email} readOnly style={{ opacity: 0.7, cursor: 'not-allowed' }} />
              </div>
              <div className="form-group">
                <label>System Role</label>
                <input type="text" value={user.role.toUpperCase()} readOnly style={{ opacity: 0.7, cursor: 'not-allowed' }} />
              </div>
            </div>
          </div>

          <div className="card" style={{ border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <h3 style={{ marginBottom: '10px', color: '#ef4444' }}>Danger Zone</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <button className="logout-btn" onClick={handleDeleteAccount}>
              Delete Account
            </button>
          </div>

        </div>

        {/* Right Column: Update Password */}
        <div className="grid-column-table">
          <div className="card">
            <h3 style={{ marginBottom: '20px', color: '#1e293b' }}>Update Password</h3>
            <form className="tnp-form" onSubmit={handlePasswordUpdate}>
              
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label>Current Password</label>
                <input 
                  type="password" 
                  placeholder="Enter current password" 
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required 
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>New Password</label>
                  <input 
                    type="password" 
                    placeholder="Enter new password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required 
                    minLength={8}
                  />
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input 
                    type="password" 
                    placeholder="Confirm new password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required 
                    minLength={8}
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>
                Update Security Credentials
              </button>
            </form>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default Profile;