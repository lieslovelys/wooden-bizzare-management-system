import React, { useState, useEffect } from 'react';
import InfoCard from '../globals/InfoCard';
import PMNotification from './PMNotification';
import '../css/admin.css';

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
        // 1. Kunin ang Active Projects count
        const statsResponse = await fetch('http://localhost:8080/api/dashboard/stats');
        let activeProjCount = 0;
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          activeProjCount = statsData.activeProjects;
        }

        // 2. Kunin ang To Verify count
        const qaResponse = await fetch('http://localhost:8080/api/qa/tasks');
        let verifyCount = 0;
        if (qaResponse.ok) {
          const qaData = await qaResponse.json();
          verifyCount = qaData.length; // Binibilang kung ilan ang nasa listahan
        }

        // I-save sa state para lumabas sa screen
        setStats({
          activeProjects: activeProjCount,
          toVerifyCount: verifyCount
        });

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
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