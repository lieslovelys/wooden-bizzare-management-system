import React from 'react';
import InfoCard from '../globals/InfoCard';
import NotificationSection from '../globals/NotificationSection';

const AdminDashboard = () => {
  const notifications = [
    { id: 1, title: "To verify", description: "Worker submit a project" },
    { id: 2, title: "Monthly Profit", description: "April, 2026 profit is here" },
    { id: 3, title: "To verify", description: "Worker submit a project" },
    { id: 4, title: "To verify", description: "Worker submit a project" },
  ];

  return (
    <div className="admin-dashboard">
      <div className="admin-stats-grid">
        <InfoCard label="ACTIVE PROJECTS" value="2" variant="green" />
        <InfoCard label="TOTAL WORKER" value="24" variant="gold" />
        <InfoCard label="MONTHLY PROFIT" value="34,000" sub="April, 2026" variant="blue" />
      </div>

      <div className="admin-divider" />

      <NotificationSection initialNotifications={notifications} />
    </div>
  );
};

export default AdminDashboard;