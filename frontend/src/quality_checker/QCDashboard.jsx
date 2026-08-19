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
        const data = await api.get('/api/qa/tasks');
        // Bibilangin lang natin kung ilang tasks ang ibinalik ng database
        setToVerifyCount(data.length);
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

      <div className="admin-divider" />
      
      {/* Tatawagin natin dito yung na-filter na verification notifications lang */}
      <QualityCheckerNotification />
      
    </div>
  );
};

export default QCDashboard;
