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
        const [statsData, qaResult] = await Promise.all([
          api.get('/api/dashboard/stats'),
          api.get('/api/qa/tasks'),
        ]);

        // P1-3: /api/qa/tasks is now paged — qaResult.data.length would only be the current
        // page size (25), not the real total. meta.total is the actual count (meta stays a
        // top-level sibling of data, unaffected by the P2 envelope unification below). See
        // ARCHITECTURE_REVIEW.md P1-3.
        // P2 (envelope unification): /api/dashboard/stats now answers {success, data} instead
        // of the bare stats object — see ARCHITECTURE_REVIEW.md P2.
        setStats({
          activeProjects: statsData.data.activeProjects,
          toVerifyCount: qaResult.meta?.total ?? 0,
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
