import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatProjectId, formatDateShort, toDateInputValue } from '../utils/format';
import { projectStatusClass } from '../utils/status';
import { api } from '../api/client';
import '../css/admin.css';

// ARCHITECTURE_REVIEW.md item 49 (REDESIGN-v2.md's dashboard v2) — the next 5 active projects by
// due date. /api/job-orders is already ORDER BY due_date ASC, id ASC and excludes Completed
// (models/jobOrderModel.js), so this just asks for the first page at limit=5; no client-side
// sort/filter needed.
const UpcomingProjects = () => {
  const [projects, setProjects] = useState(null); // null while the first fetch is in flight
  const [error, setError] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const { data } = await api.get('/api/job-orders?limit=5');
        if (!ignore) setProjects(data || []);
      } catch (err) {
        console.error('Error fetching upcoming projects:', err.message);
        if (!ignore) setError(true);
      }
    })();
    return () => { ignore = true; };
  }, []);

  const loading = projects === null && !error;
  const hasRows = Array.isArray(projects) && projects.length > 0;

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return (
    <div className="wb-panel up-panel">
      <div className="wb-panel__header">
        <div>
          <h2 className="wb-panel__title">Upcoming projects</h2>
          <span className="wb-panel__subtitle">Soonest due first</span>
        </div>
        <Link to="/admin/job-order" className="wb-btn wb-btn--ghost">
          View all
          <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </Link>
      </div>

      {loading ? (
        <div className="up-list" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="up-skeleton-row">
              <span className="wb-skeleton up-skeleton-line up-skeleton-line-title"></span>
              <span className="wb-skeleton up-skeleton-line up-skeleton-line-sub"></span>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="wb-empty">
          <div className="wb-empty__icon"><i className="fa-solid fa-clipboard" aria-hidden="true"></i></div>
          <div className="wb-empty__title">Couldn't load projects.</div>
        </div>
      ) : hasRows ? (
        <div className="up-list">
          {projects.map((p) => {
            const overdue = toDateInputValue(p.due_date) < today;
            const isHigh = p.priority_level === 'High';
            return (
              <Link
                key={p.id}
                to="/admin/job-order"
                state={{ targetProjectId: p.id }}
                className="up-row"
              >
                <div className="up-row-main">
                  <span className="up-row-name">{p.project_name}</span>
                  <span className="up-row-meta">
                    <span className="up-row-code">{formatProjectId(p.id)}</span>
                    {p.client_name && <span>{p.client_name}</span>}
                    <span className={`up-priority${isHigh ? ' up-priority--high' : ''}`}>
                      <i className="fa-solid fa-flag" aria-hidden="true"></i>
                      {p.priority_level || 'N/A'}
                    </span>
                  </span>
                </div>
                <div className="up-row-side">
                  <span className={`wb-badge ${projectStatusClass(p.status)}`}>{p.status}</span>
                  <span className={`up-due${overdue ? ' up-due--overdue' : ''}`}>
                    <i className={`fa-solid ${overdue ? 'fa-circle-exclamation' : 'fa-calendar'}`} aria-hidden="true"></i>
                    {overdue ? 'Overdue · ' : 'Due '}{formatDateShort(p.due_date)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="wb-empty">
          <div className="wb-empty__icon"><i className="fa-solid fa-clipboard" aria-hidden="true"></i></div>
          <div className="wb-empty__title">No active projects</div>
          <div className="wb-empty__text">New projects appear here, soonest due first.</div>
          <Link to="/admin/create-project" className="wb-btn wb-btn--secondary">
            <i className="fa-solid fa-plus" aria-hidden="true"></i>
            Create project
          </Link>
        </div>
      )}
    </div>
  );
};

export default UpcomingProjects;
