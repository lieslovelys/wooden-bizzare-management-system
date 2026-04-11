import React, { useState, useEffect } from 'react';
import '../css/admin.css'; // Siguraduhing tama ang path na ito papunta sa admin.css mo

const ProjectHistory = () => {
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [remarksFilter, setRemarksFilter] = useState('All');

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const response = await fetch('http://localhost:8080/api/projects/history');
        const result = await response.json();
        if (result.success) {
          const formattedData = result.data.map(proj => {
            const remark = calculateRemark(proj.date_completed, proj.due_date);
            return {
              ...proj,
              remark: remark
            };
          });
          setHistoryData(formattedData);
        }
      } catch (error) {
        console.error("Error fetching project history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const calculateRemark = (completedStr, dueStr) => {
    if (!completedStr || !dueStr) return 'Unknown';
    
    const completedDate = new Date(completedStr);
    const dueDate = new Date(dueStr);
    
    completedDate.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    if (completedDate < dueDate) return 'Early';
    if (completedDate > dueDate) return 'Late';
    return 'On-time';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  const displayedHistory = remarksFilter === 'All' 
    ? historyData 
    : historyData.filter(proj => proj.remark === remarksFilter);

  // --- DITO NA KUKUHA NG CLASS NAME BASE SA REMARK ---
  const getBadgeClass = (remark) => {
    switch (remark) {
      case 'Early': return 'ph-badge ph-badge-early';
      case 'On-time': return 'ph-badge ph-badge-ontime';
      case 'Late': return 'ph-badge ph-badge-late';
      default: return 'ph-badge';
    }
  };

  return (
    <div className="ph-container">
      <h1 className="ph-title">PROJECT HISTORY</h1>

      <div className="ph-controls">
        <select 
          className="ph-filter-select"
          value={remarksFilter}
          onChange={(e) => setRemarksFilter(e.target.value)}
        >
          <option value="All">Remarks (All)</option>
          <option value="Early">Early</option>
          <option value="On-time">On-time</option>
          <option value="Late">Late</option>
        </select>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center' }}>Loading history...</p>
      ) : (
        <table className="ph-table">
          <thead>
            <tr>
              <th className="ph-th">Project ID</th>
              <th className="ph-th">Project Name</th>
              <th className="ph-th">Date Started</th>
              <th className="ph-th">Date Completed</th>
              <th className="ph-th">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {displayedHistory.length > 0 ? (
              displayedHistory.map((proj) => (
                <tr key={proj.id} className="ph-tr">
                  <td className="ph-td">{proj.id}</td>
                  <td className="ph-td ph-project-name">{proj.project_name}</td>
                  <td className="ph-td">{formatDate(proj.date_started)}</td>
                  <td className="ph-td">{formatDate(proj.date_completed)}</td>
                  <td className="ph-td">
                    <span className={getBadgeClass(proj.remark)}>
                      {proj.remark}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="ph-empty-state">
                  Walang nakitang history base sa filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ProjectHistory;