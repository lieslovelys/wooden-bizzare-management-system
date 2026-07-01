import React, { useState, useEffect } from 'react';
import InfoCard from '../globals/InfoCard';
import AdminNotification from './AdminNotification';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    activeProjects: 0,
    totalWorkers: 0,
    monthlyProfit: 0 // Ginawa na nating 0 ang default
  });

  // Dynamic na pagkuha ng Current Month at Year (e.g., "April, 2026")
  const currentMonthYear = new Date().toLocaleString('default', { 
    month: 'long', 
    year: 'numeric' 
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // FIX: Tinanggal ang localhost dito
        const response = await fetch(import.meta.env.VITE_BACKEND_IP + '/api/dashboard/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(prev => ({
            ...prev,
            activeProjects: data.activeProjects || 0,
            totalWorkers: data.totalWorkers || 0,
            monthlyProfit: data.monthlyProfit || 0 // Sinalo natin yung monthlyProfit galing backend
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
            sub={currentMonthYear} // Ipinalit natin dito yung dynamic date
            variant="blue" 
        />
      </div>
      <div className="admin-divider" />
      
      <AdminNotification />
    </div>
  );
};

export default AdminDashboard;
