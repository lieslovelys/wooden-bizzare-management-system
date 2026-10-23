import React, { useState, useEffect } from 'react';
import InfoCard from '../globals/InfoCard';
import QualityCheckerNotification from './QualityCheckerNotification';
import { api } from '../api/client';

import '../css/admin.css';

const QCDashboard = () => {
  const [toVerifyCount, setToVerifyCount] = useState(0);

  useEffect(() => {
    // Gagamitin natin yung existing API mo para sa QA tasks
    const fetchQATasks = async () => {
      try {
        // P1-3: /api/qa/tasks is now paged — data.length would only be the current page size
        // (25), not the real total. meta.total is the actual count. See
        // ARCHITECTURE_REVIEW.md P1-3.
        const result = await api.get('/api/qa/tasks');
        setToVerifyCount(result.meta?.total ?? 0);
      } catch (error) {
        console.error("Error fetching tasks to verify:", error.message);
      }
    };

    fetchQATasks();
  }, []);

  return (
    <div className="admin-dashboard">
      
      {/* Gumamit tayo ng inline style dito na maxWidth para hindi sobrang 
        haba ng isang card kung sakaling naka-grid ng 3 columns ang admin-stats-grid mo.
      */}
      <div className="admin-stats-grid" style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
        <div style={{ minWidth: '300px', maxWidth: '400px', width: '100%' }}>
          <InfoCard 
              label="TASKS TO VERIFY" 
              value={toVerifyCount} 
              variant="gold" // Pwede mong palitan ng "blue" o "green" depende sa gusto mo
          />
        </div>
      </div>

      {/* ARCHITECTURE_REVIEW.md item 44 — the 6px gradient divider is gone; the panel's own
          margin/border now separate the sections (see REDESIGN.md and A_Dashboard.jsx). */}
      {/* Tatawagin natin dito yung na-filter na verification notifications lang */}
      <QualityCheckerNotification />
      
    </div>
  );
};

export default QCDashboard;
