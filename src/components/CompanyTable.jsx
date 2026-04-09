import React from 'react';

const CompanyTable = ({ isAdmin }) => {
  // Sample Data matching your screenshot
  const data = [
    { name: 'google2', type: 'Internship', status: 'Completed', cgpa: 7 },
    { name: 'bmw', type: 'Placement', status: 'Not Started', cgpa: 7 },
    { name: 'accenture', type: 'Placement', status: 'Not Started', cgpa: 5 },
  ];

  return (
    <div className="card">
      <h3>Registered Companies ({data.length})</h3>
      <table className="tnp-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Type</th>
            <th>Status</th>
            <th>CGPA</th>
            {isAdmin && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((company, index) => (
            <tr key={index}>
              <td>{company.name}</td>
              <td><span className="badge-type">{company.type}</span></td>
              <td>
                <span className={`badge-status ${company.status.toLowerCase().replace(' ', '-')}`}>
                  {company.status}
                </span>
              </td>
              <td>{company.cgpa}</td>
              {isAdmin && (
                <td className="action-btns">
                  <button title="View">👁️</button>
                  <button title="Delete">🗑️</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CompanyTable;