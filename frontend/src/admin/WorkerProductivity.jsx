import React, { useState, useEffect } from 'react';
import '../css/admin.css';
import { api } from '../api/client';

const WorkerProductivity = () => {
    const [productivityData, setProductivityData] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [activeTab, setActiveTab] = useState('Regular'); 
    const [roleFilter, setRoleFilter] = useState('All'); 

    useEffect(() => {
        const fetchProductivity = async () => {
            try {
                // P1-3: capped-only, defaulting to a high limit server-side — no ?limit= is sent
                // here, so this still gets the full leaderboard, just wrapped in
                // {success, data, meta} instead of a bare array. See ARCHITECTURE_REVIEW.md P1-3.
                const result = await api.get('/api/productivity');
                setProductivityData(result.data || []);
            } catch (error) {
                console.error("Error fetching productivity data:", error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchProductivity();
    }, []);

    const filteredData = productivityData.filter(worker => {
        const matchTab = worker.job_type && worker.job_type.toLowerCase() === activeTab.toLowerCase();
        const matchRole = roleFilter === 'All' || (worker.job_role && worker.job_role.toLowerCase() === roleFilter.toLowerCase());
        return matchTab && matchRole;
    });

    return (
        <div className="prod-wrapper">
            <h2 className="prod-header-title">Task Progress and QC Result</h2>

            <div className="prod-tabs-container">
                <button 
                    className={`prod-tab ${activeTab === 'Regular' ? 'active' : ''}`}
                    onClick={() => setActiveTab('Regular')}
                >
                    Regular Workers
                </button>
                <button 
                    className={`prod-tab ${activeTab === 'Part-Time' ? 'active' : ''}`}
                    onClick={() => setActiveTab('Part-Time')}
                >
                    Part-time Workers
                </button>
            </div>

            <div className="prod-filter-container">
                <select 
                    className="prod-dropdown" 
                    value={roleFilter} 
                    onChange={(e) => setRoleFilter(e.target.value)}
                >
                    <option value="All">All Roles</option>
                    <option value="Carpenter">Carpenter</option>
                    <option value="Carver">Carver</option>
                    <option value="Liha">Liha</option>
                    <option value="Painter">Painter</option>
                </select>
            </div>

            {loading ? (
                <p style={{ textAlign: 'center', marginTop: '20px' }}>Loading productivity records...</p>
            ) : (
                <div className="prod-table-responsive">
                    <table className="prod-table">
                        <thead>
                            <tr>
                                <th style={{textAlign: 'left', paddingLeft: '20px'}}>Rank & Name</th>
                                <th>Early</th>
                                <th>On-Time</th>
                                <th>Late</th>
                                <th>Accepted</th>
                                <th>For Repair</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.length > 0 ? (
                                filteredData.map((worker, index) => {
                                    // LOGIC PARA SA LEADERBOARD COLORS
                                    const rankClass = index === 0 ? 'rank-gold' 
                                                    : index === 1 ? 'rank-silver' 
                                                    : index === 2 ? 'rank-bronze' 
                                                    : 'rank-normal';

                                    return (
                                        <tr key={worker.user_id} className={`prod-row ${rankClass}`}>
                                            <td className="rank-col">
                                                <div className="rank-badge-container">
                                                    <span className="rank-number">{index + 1}</span>
                                                </div>
                                                <div className="rank-details">
                                                    <span className="rank-name">{worker.worker_name}</span>
                                                    <span className="rank-role">{worker.job_role || 'Worker'}</span>
                                                </div>
                                            </td>
                                            <td><span className="stat-pill">{worker.early_count}</span></td>
                                            <td><span className="stat-pill">{worker.on_time_count}</span></td>
                                            <td><span className="stat-pill error-text">{worker.late_count}</span></td>
                                            <td><span className="stat-pill success-text">{worker.accepted_count}</span></td>
                                            <td><span className="stat-pill error-text">{worker.repair_count}</span></td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#8B7E5C' }}>
                                        No workers found for this category.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default WorkerProductivity;
