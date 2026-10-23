import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import InfoCard from '../globals/InfoCard';
import AdminNotification from './AdminNotification';
import ProfitTrendChart from './ProfitTrendChart';
import UpcomingProjects from './UpcomingProjects';
import { api } from '../api/client';
import { formatCurrency } from '../utils/format';
import '../css/admin.css';

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
        // P2 (envelope unification): /api/dashboard/stats now answers {success, data} instead
        // of the bare stats object — see ARCHITECTURE_REVIEW.md P2.
        const { data } = await api.get('/api/dashboard/stats');
        setStats(prev => ({
          ...prev,
          activeProjects: data.activeProjects || 0,
          totalWorkers: data.totalWorkers || 0,
          monthlyProfit: data.monthlyProfit || 0 // Sinalo natin yung monthlyProfit galing backend
        }));
      } catch (error) {
        console.error("Error fetching dashboard stats:", error.message);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="admin-dashboard">
      {/* ARCHITECTURE_REVIEW.md item 44 — a compact page header replaces the old 6px gradient
          divider as the section separator; the month reuses the same dynamic value the profit
          card's sub-line already computed.
          item 49 (REDESIGN-v2.md) — restyled onto the shared .wb-page-header kit class and adds
          the "Create project" shortcut the user asked for. */}
      <div className="wb-page-header">
        <div>
          <h1 className="wb-page-header__title">Dashboard</h1>
          <span className="wb-page-header__subtitle">{currentMonthYear}</span>
        </div>
        <Link to="/admin/create-project" className="wb-btn wb-btn--primary">
          <i className="fa-solid fa-plus" aria-hidden="true"></i>
          Create project
        </Link>
      </div>

      <div className="admin-stats-grid">
        {/* item 44 — labels are sentence case (CSS still renders them uppercase) so a screen
            reader doesn't spell out "ACTIVE PROJECTS" letter by letter; variants reassigned per
            REDESIGN.md (projects = info, workers = gold, profit = success, since it's money). */}
        <InfoCard
            label="Active projects"
            value={stats.activeProjects}
            variant="blue"
        />
        <InfoCard
            label="Total workers"
            value={stats.totalWorkers}
            variant="gold"
        />
        <InfoCard
            label="Monthly profit"
            value={formatCurrency(stats.monthlyProfit)}
            sub={currentMonthYear} // Ipinalit natin dito yung dynamic date
            variant="green"
        />
      </div>

      {/* item 49 — the dashboard v2 grid: profit trend + upcoming projects on the left,
          notifications (icon-free, 6 per page) filling the right column. */}
      <div className="admin-dash-grid">
        <div className="admin-dash-grid-main">
          <ProfitTrendChart />
          <UpcomingProjects />
        </div>
        <AdminNotification embedded pageSize={6} />
      </div>
    </div>
  );
};

export default AdminDashboard;
