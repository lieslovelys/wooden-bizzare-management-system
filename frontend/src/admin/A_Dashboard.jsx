import React, { useState, useEffect } from 'react';
import InfoCard from '../globals/InfoCard';
import AdminNotification from './AdminNotification';

const AdminDashboard = () => {
  // State para sa stats na kukunin natin sa database
  const [stats, setStats] = useState({
    activeProjects: 0,
    totalWorkers: 0,
    monthlyProfit: 34000 
  });


  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('http://localhost:8080/api/dashboard/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(prev => ({
            ...prev,
            activeProjects: data.activeProjects,
            totalWorkers: data.totalWorkers
          }));
        }
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="admin-dashboard">
      <div className="admin-stats-grid">
        <InfoCard 
            label="ACTIVE PROJECTS" 
            value={stats.activeProjects} 
            variant="green" 
        />
        <InfoCard 
            label="TOTAL WORKER" 
            value={stats.totalWorkers} 
            variant="gold" 
        />
        <InfoCard 
            label="MONTHLY PROFIT" 
            value={stats.monthlyProfit.toLocaleString()} 
            sub="April, 2026" 
            variant="blue" 
        />
      </div>
      <div className="admin-divider" />
      
      <AdminNotification />
    </div>
  );
};

export default AdminDashboard;