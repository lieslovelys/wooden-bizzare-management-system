import React, { useState } from 'react';

const JobOrder = () => {
  const [currentView, setCurrentView] = useState('list');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [hoveredOrder, setHoveredOrder] = useState(null);

  const jobOrders = [
    { id: 'FR-0038', title: 'LUXURY FRAME' },
    { id: 'FR-0088', title: 'STRANDED FRAME' },
    { id: 'DR-0022', title: 'FRONT DOOR' },
  ];

  const getBackgroundClass = (orderId) => {
    if (selectedOrder === orderId) return 'job-order-item-selected';
    if (hoveredOrder === orderId) return 'job-order-item-hover';
    return 'job-order-item-default';
  };

  const JobOrderList = () => (
    <div className="job-order-list">
      <h1 className="job-order-title">JOB ORDER LIST</h1>
      <p className="job-order-subtitle">Click order to view</p>
      <div className="job-order-divider" />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {jobOrders.map((order) => (
          <div
            key={order.id}
            onClick={() => { setSelectedOrder(order.id); setCurrentView('details'); }}
            onMouseEnter={() => setHoveredOrder(order.id)}
            onMouseLeave={() => setHoveredOrder(null)}
            className={`job-order-item ${getBackgroundClass(order.id)}`}
          >
            <span className="job-order-id">{order.id}</span>
            <span className="job-order-name">{order.title}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const JobOrderDetails = () => (
    <div className="job-order-details">
      <div className="details-card">
        <div className="details-left">
          <div className="details-header">
            <h2>FR-0038</h2>
            <p>Luxury Frame</p>
          </div>
          
          <div className="details-info">
            <p className="details-info-label">Date Ordered</p>
            <p className="details-info-value">April 1, 2026</p>
          </div>
          
          <div className="details-info details-info-urgent">
            <p className="details-info-label">Due Date</p>
            <p className="details-info-value details-info-value-urgent">May 25, 2026</p>
          </div>

          <div className="details-info details-info-priority">
            <p className="details-info-label">Priority</p>
            <p className="details-info-value details-info-value-priority">High</p>
          </div>
        </div>

        <div className="details-right">
            <p className="project-details-label">Project Details</p>
            <div className="project-details-scroll">
                <div className="project-detail-item">
                    <p className="project-detail-title">Size</p>
                    <p className="project-detail-desc">Deep Shadow Boxes (50mm+ depth): Used for 3D memorabilia or to create a 3D float effect, enhancing the depth and presence of an object.</p>
                </div>
                <div className="project-detail-item">
                    <p className="project-detail-title">Color</p>
                    <p className="project-detail-desc">Brushed Gold & Warm Metallics (Champagne/Brass): The defining metal finish, offering a muted, sophisticated glow rather than bright yellow gold.</p>
                </div>
            </div>
        </div>
      </div>

      <div className="progress-card">
        <div className="progress-header">
          <h3 className="progress-title">Project Progress</h3>
          <div className="progress-bar-container">
             <div className="progress-bar">
                <div className="progress-bar-fill"></div>
             </div>
             <span className="progress-count">1/6</span>
          </div>
        </div>

        <table className="progress-table">
          <thead>
            <tr>
              <th>STAGE</th>
              <th>WORKER</th>
              <th>START DATE</th>
              <th>DUE DATE</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="stage-name">Carpenter</td>
              <td>John Kenneth Juralbal</td>
              <td>04/5/26</td>
              <td>04/23/26</td>
              <td><span className="status-done">Done</span></td>
            </tr>
            <tr>
              <td className="stage-name">Carver</td>
              <td>Laurence Orot</td>
              <td>04/25/26</td>
              <td>05/15/26</td>
              <td><span className="status-progress">In progress</span></td>
            </tr>
            {[1, 2].map((i) => (
               <tr key={i} className="empty">
                 <td></td>
                 <td></td>
                 <td></td>
                 <td></td>
                 <td></td>
               </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isSubmitted ? (
        <button 
          onClick={() => setIsSubmitted(true)}
          className="submit-button"
        >
          I AM DONE
        </button>
      ) : (
        <button 
          onClick={() => {setIsSubmitted(false); setCurrentView('list');}}
          className="submitted-button"
        >
          WORK SUBMITTED
        </button>
      )}
    </div>
  );

  return (
    <div className="job-order-container">
      {currentView === 'list' ? <JobOrderList /> : <JobOrderDetails />}
    </div>
  );
};

export default JobOrder;