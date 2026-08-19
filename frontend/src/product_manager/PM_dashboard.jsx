import React, { useState, useEffect } from 'react';
import InfoCard from '../globals/InfoCard';
import PMNotification from './PMNotification';
import '../css/admin.css';
import { api } from '../api/client';

const ManagerDashboard = () => {
  // Pinagsama natin ang state para sa dalawang cards
  const [stats, setStats] = useState({
    activeProjects: 0,
    toVerifyCount: 0
  });

  useEffect(() => {
    // Kukunin natin nang sabay ang data mula sa dalawang magkaibang API
    const fetchDashboardData = async () => {
      try {
        const [statsData, qaData] = await Promise.all([
          api.get('/api/dashboard/stats'),
          api.get('/api/qa/tasks'),
        ]);

        // I-save sa state para lumabas sa screen
        setStats({
          activeProjects: statsData.activeProjects,
          toVerifyCount: qaData.length,
        });

      } catch (error) {
        console.error("Error fetching dashboard data:", error.message);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="admin-dashboard">
      
      {/* Ginamitan natin ng flex para pumagitna at maging pantay ang dalawang cards */}
      <div className="admin-stats-grid" style={{ display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap' }}>
        
        <div style={{ flex: '1', minWidth: '250px', maxWidth: '400px' }}>
          <InfoCard 
              label="ACTIVE PROJECTS" 
              value={stats.activeProjects} 
              variant="green" 
          />
        </div>

        <div style={{ flex: '1', minWidth: '250px', maxWidth: '400px' }}>
          <InfoCard 
              label="TASKS TO VERIFY" 
              value={stats.toVerifyCount} 
              variant="gold" 
          />
        </div>

      </div>

      <div className="admin-divider" />
      
      {/* Ipakita ang notifications sa ibaba. Palitan ang component kung iba ang gusto mong ilagay */}
      <PMNotification />
      
    </div>
  );
};

export default ManagerDashboard;
