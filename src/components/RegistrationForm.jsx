import React from 'react';

const RegistrationForm = () => {
  const branches = ['CSE', 'ECE', 'EEE', 'ME', 'CE', 'IT', 'CHE', 'BIO'];

  return (
    <div className="card">
      <h3>Register Company</h3>
      <form className="tnp-form">
        <div className="form-row">
          <div className="form-group">
            <label>Company Name</label>
            <input type="text" placeholder="e.g. Google" />
          </div>
          <div className="form-group">
            <label>Type</label>
            <select>
              <option>Placement</option>
              <option>Internship</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Minimum CGPA</label>
            <input type="number" step="0.1" placeholder="7.0" />
          </div>
          <div className="form-group">
            <label>Positions Available</label>
            <input type="number" placeholder="5" />
          </div>
        </div>

        <div className="branch-selection">
          <label>Eligible Branches</label>
          <div className="checkbox-grid">
            {branches.map(branch => (
              <label key={branch} className="checkbox-item">
                <input type="checkbox" /> {branch}
              </label>
            ))}
          </div>
        </div>

        <button type="submit" className="btn-primary">Register Company</button>
      </form>
    </div>
  );
};

export default RegistrationForm;