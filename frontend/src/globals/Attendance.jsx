import React, { useEffect, useId, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { formatTime12h, formatWorkerId, workerPhotoUrl } from '../utils/format';
import { usePaginatedList } from '../hooks/usePaginatedList';
import Pagination from './Pagination';
import ConfirmModal from './ConfirmModal';

const API = '/api';

// --- Module-scope helpers and sub-components ---
//
// These five components (WorkerAvatar, EmployeeListView, AttendanceLogView, AddAttendanceModal,
// EditAttendanceModal) used to be defined *inside* the Attendance component's render body. Every
// parent re-render created new component identities for all five, so React unmounted and
// remounted them — which silently discarded AddAttendanceModal's/EditAttendanceModal's half-typed
// form state on any unrelated parent state change (e.g. a toast firing after a delete). Hoisting
// them to module scope with explicit props is the real fix, not a lint workaround — see
// ARCHITECTURE_REVIEW.md P2.

const getInitials = (worker) => {
  if (!worker) return '?';
  const f = worker.first_name?.[0] ?? '';
  const l = worker.last_name?.[0] ?? '';
  return `${f}${l}`.toUpperCase() || '?';
};

// M/D/YY — distinct from utils/format.js's formatDate/formatDateShort, kept local since it's
// only used in this log table's Date column.
const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getMonth() + 1}/${dt.getDate()}/${String(dt.getFullYear()).slice(-2)}`;
};

// FR-5: status/late_minutes are computed server-side (services/attendanceService.js) — this is
// display-only, no computation happens here. "Late · 16m" gives the minutes without a second
// column; other statuses have nothing extra to show.
const statusLabel = (row) => (
  row.status === 'Late' && row.late_minutes > 0 ? `Late · ${row.late_minutes}m` : (row.status || 'Absent')
);
const statusClass = (row) => `att-status-badge ${(row.status || 'Absent').toLowerCase().replace(' ', '-')}`;

const WorkerAvatar = ({ worker, size = 64, className = '' }) => {
  const [imgError, setImgError] = useState(false);
  const src = workerPhotoUrl(worker);
  const style = { width: size, height: size, borderRadius: '16px', objectFit: 'cover', flexShrink: 0, boxShadow: '0 4px 10px rgba(0,0,0,0.1)' };
  if (src && !imgError) {
    const name = worker ? `${worker.first_name ?? ''} ${worker.last_name ?? ''}`.trim() : '';
    return <img src={src} alt={name ? `${name}'s photo` : 'Worker photo'} style={style} className={className} onError={() => setImgError(true)} />;
  }
  return (
    <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-surface-cream)', color: 'var(--color-accent)', fontWeight: 700, fontSize: size * 0.35 }}>
      {getInitials(worker)}
    </div>
  );
};

const EmployeeListView = ({ searchQuery, setSearchQuery, typeFilter, setTypeFilter, loading, filteredEmployees, onSelectWorker }) => (
  <div>
    <h1 className="attendance-title">LIST OF WORKERS</h1>
    <p className="qc-pv-subtitle">Click worker to add attendance</p>
    <div className="attendance-divider" />

    <div className="list-controls-grid">
      <div className="list-search-wrapper">
        <svg className="list-search-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="text"
          aria-label="Search worker's ID or name"
          placeholder="Search worker's ID or name..."
          className="list-search-input"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <select
        aria-label="Filter by worker type"
        className="list-type-select"
        value={typeFilter}
        onChange={e => setTypeFilter(e.target.value)}
      >
        <option value="All">Type</option>
        <option value="Carpenter">Carpenter</option>
        <option value="Delivery">Delivery</option>
        <option value="Quality Control">Quality Control</option>
        <option value="Painter">Painter</option>
        <option value="Liha">Liha</option>
        <option value="Carver">Carver</option>
      </select>
    </div>

    {loading ? (
      <p style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Loading employees...</p>
    ) : (
      <div className="att-grid-wrapper">
        {/* Header */}
        <div className="att-header">
          <div>ID</div>
          <div>Name</div>
          <div>Type</div>
        </div>

        {/* Grid Items */}
        {filteredEmployees.length === 0 ? (
          <div style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>No workers found.</div>
        ) : (
          filteredEmployees.map(emp => (
            <div className="att-item" key={emp.user_id} onClick={() => onSelectWorker(emp)}>
              <div>{formatWorkerId(emp.user_id)}</div>
              <div>{`${emp.last_name}, ${emp.first_name} ${emp.middle_name && emp.middle_name !== 'None' ? emp.middle_name : ''}`.toUpperCase()}</div>
              <div>{emp.job_role}</div>
            </div>
          ))
        )}
      </div>
    )}
  </div>
);

const AttendanceLogView = ({ worker, logLoading, attendanceLog, logMeta, logPage, onLogPageChange, onAddClick, onEditClick, onDeleteClick }) => {
  const workerLabel = worker
    ? `${worker.last_name ?? ''}, ${worker.first_name ?? ''} ${worker.middle_name && worker.middle_name !== 'None' ? worker.middle_name.charAt(0) + '.' : ''}`.trim().toUpperCase()
    : '—';
  const workerId = worker ? formatWorkerId(worker.user_id) : '—';

  return (
    <div>
      <div className="attendance-log-header">
        <WorkerAvatar worker={worker} size={150} />
        <div className="attendance-log-info-stack">
          <div className="attendance-log-card">
            <h2 className="attendance-log-name">{workerLabel}</h2>
            <span className="attendance-log-id">{workerId}</span>
          </div>
          <div className="attendance-log-card">
            <h3 className="attendance-log-role">{worker?.job_role ?? '—'}</h3>
            <p className="attendance-log-type">{worker?.job_type ?? '—'}</p>
          </div>
        </div>
      </div>

      <div>
        <div className="attendance-log-title">
          <h3>ATTENDANCE LOG</h3>
          <button onClick={onAddClick} className="attendance-log-add-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add attendance
          </button>
        </div>

        {logLoading ? (
          <p style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Loading log...</p>
        ) : (
          <div className="att-grid-wrapper">
            <div className="log-header">
              <div>Day</div>
              <div>Date</div>
              <div>Time In</div>
              <div>Time Out</div>
              <div>Status</div>
              <div style={{ textAlign: 'center' }}>Actions</div>
            </div>

            {attendanceLog.length === 0 ? (
              <div style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>No attendance records.</div>
            ) : (
              attendanceLog.map(row => (
                <div className="log-item" key={row.id}>
                  <div>{row.day_of_week?.trim()}</div>
                  <div>{fmtDate(row.date)}</div>
                  <div>{formatTime12h(row.time_in)}</div>
                  <div>{formatTime12h(row.time_out)}</div>
                  <div><span className={statusClass(row)}>{statusLabel(row)}</span></div>
                  <div className="attendance-log-actions" style={{ justifyContent: 'center' }}>
                    <button className="attendance-log-edit-btn" onClick={() => onEditClick(row)}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                      Edit
                    </button>
                    <button className="attendance-log-delete-btn" aria-label="Delete this attendance record" onClick={() => onDeleteClick(row.id)}>
                      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <Pagination page={logPage} meta={logMeta} onChange={onLogPageChange} />
      </div>
    </div>
  );
};

const AddAttendanceModal = ({ worker, onClose, onSaved, showToast }) => {
  const id = useId();
  const [formData, setFormData] = useState({ date: '', time_in: '08:30', time_out: '17:00', day_of_week: '—' });
  const [saving, setSaving] = useState(false);

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const newDay = newDate ? days[new Date(newDate).getDay()] : '—';
    setFormData({ ...formData, date: newDate, day_of_week: newDay });
  };

  const handleAdd = async () => {
    if (!formData.date) { showToast('Date is required.', 'error'); return; }
    setSaving(true);
    try {
      await api.post(`${API}/attendance`, {
        worker_id: worker.user_id,
        date: formData.date,
        day_of_week: formData.day_of_week,
        time_in: formData.time_in || null,
        time_out: formData.time_out || null,
      });
      showToast('Attendance added successfully!', 'success');
      onSaved();
    } catch (err) { showToast(err.message || 'Failed to add attendance.', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="custom-modal-overlay" onClick={onClose}>
      <div className="custom-modal-content" onClick={e => e.stopPropagation()}>
        <h3 className="custom-modal-title">Add Attendance</h3>

        <div className="custom-modal-grid">
          <div className="custom-form-group">
            <label htmlFor={`${id}-date`}>Date</label>
            <input id={`${id}-date`} type="date" value={formData.date} onChange={handleDateChange} />
          </div>
          <div className="custom-form-group">
            <label htmlFor={`${id}-day`}>Day</label>
            <input id={`${id}-day`} type="text" value={formData.day_of_week} readOnly className="read-only-input" />
          </div>
          <div className="custom-form-group">
            <label htmlFor={`${id}-timeIn`}>Time In</label>
            <input id={`${id}-timeIn`} type="time" value={formData.time_in} onChange={e => setFormData({ ...formData, time_in: e.target.value })} />
          </div>
          <div className="custom-form-group">
            <label htmlFor={`${id}-timeOut`}>Time Out</label>
            <input id={`${id}-timeOut`} type="time" value={formData.time_out} onChange={e => setFormData({ ...formData, time_out: e.target.value })} />
          </div>
        </div>

        <div className="custom-modal-actions">
          <button className="custom-modal-btn cancel" onClick={onClose}>Cancel</button>
          <button className="custom-modal-btn" onClick={handleAdd} disabled={saving}>{saving ? 'Adding...' : 'Add Record'}</button>
        </div>
      </div>
    </div>
  );
};

const EditAttendanceModal = ({ record, onClose, onSaved, showToast }) => {
  const id = useId();
  const [formData, setFormData] = useState({
    date: record?.date?.slice(0, 10) ?? '',
    day_of_week: record?.day_of_week?.trim() ?? '—',
    time_in: record?.time_in?.slice(0, 5) ?? '',
    time_out: record?.time_out?.slice(0, 5) ?? '',
  });
  const [saving, setSaving] = useState(false);

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const newDay = newDate ? days[new Date(newDate).getDay()] : '—';
    setFormData({ ...formData, date: newDate, day_of_week: newDay });
  };

  const handleUpdate = async () => {
    if (!formData.date) { showToast('Date is required.', 'error'); return; }
    setSaving(true);
    try {
      await api.put(`${API}/attendance/${record.id}`, {
        date: formData.date,
        day_of_week: formData.day_of_week,
        time_in: formData.time_in || null,
        time_out: formData.time_out || null,
      });
      showToast('Attendance updated successfully!', 'success');
      onSaved();
    } catch (err) { showToast(err.message || 'Failed to update attendance.', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="custom-modal-overlay" onClick={onClose}>
      <div className="custom-modal-content" onClick={e => e.stopPropagation()}>
        <h3 className="custom-modal-title">Edit Attendance</h3>

        <div className="custom-modal-grid">
          <div className="custom-form-group">
            <label htmlFor={`${id}-date`}>Date</label>
            <input id={`${id}-date`} type="date" value={formData.date} onChange={handleDateChange} />
          </div>
          <div className="custom-form-group">
            <label htmlFor={`${id}-day`}>Day</label>
            <input id={`${id}-day`} type="text" value={formData.day_of_week} readOnly className="read-only-input" />
          </div>
          <div className="custom-form-group">
            <label htmlFor={`${id}-timeIn`}>Time In</label>
            <input id={`${id}-timeIn`} type="time" value={formData.time_in} onChange={e => setFormData({ ...formData, time_in: e.target.value })} />
          </div>
          <div className="custom-form-group">
            <label htmlFor={`${id}-timeOut`}>Time Out</label>
            <input id={`${id}-timeOut`} type="time" value={formData.time_out} onChange={e => setFormData({ ...formData, time_out: e.target.value })} />
          </div>
        </div>

        <div className="custom-modal-actions">
          <button className="custom-modal-btn cancel" onClick={onClose}>Cancel</button>
          <button className="custom-modal-btn" onClick={handleUpdate} disabled={saving}>{saving ? 'Updating...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
};

// --- Main component ---

const Attendance = () => {
  const [view, setView] = useState('list');
  const [editingRecord, setEditingRecord] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');

  // recordToDelete being non-null is what opens the modal — no separate boolean needed.
  const [recordToDelete, setRecordToDelete] = useState(null);

  const showToast = useToast();

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        // P2 (envelope unification): every route now reliably answers {success, data}, so the
        // old `data.data || data` bare-body fallback no longer has a case to catch.
        const data = await api.get(`${API}/workers`);
        if (!ignore) setEmployees(data.data || []);
      } catch (err) {
        if (!ignore) console.error('Error fetching employees:', err.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, []);

  // P1-3: server-paginated — the attendance log is the highest-cardinality list in the app (one
  // row per worker per day, unbounded growth). See ARCHITECTURE_REVIEW.md P1-3. Keyed by the
  // selected worker's id, so switching workers automatically refetches (and a falsy endpoint
  // before a worker is selected skips fetching entirely).
  const {
    rows: attendanceLog,
    setRows: setAttendanceLog,
    meta: logMeta,
    page: logPage,
    setPage: setLogPage,
    loading: logLoading,
    refetch: refetchLog,
  } = usePaginatedList(selectedWorker ? `${API}/attendance/worker/${selectedWorker.user_id}` : null, { pageSize: 25 });

  const handleSelectWorker = (worker) => {
    if (!worker.user_id) { return; }
    setSelectedWorker(worker);
    setView('log');
  };

  const handleDeleteClick = (id) => {
    setRecordToDelete(id);
  };

  const executeDelete = async () => {
    if (!recordToDelete) return;
    const id = recordToDelete;
    setRecordToDelete(null);
    try {
      await api.delete(`${API}/attendance/${id}`);
      // Deleting a single row doesn't change which rows belong on this page, so update it in
      // place rather than round-tripping for a full refetch.
      setAttendanceLog(prev => prev.filter(r => r.id !== id));
      showToast("Record deleted successfully!", "success");
    } catch (err) {
      showToast(err.message || "Failed to delete record.", "error");
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const firstName = emp.first_name ?? '';
    const lastName = emp.last_name ?? '';
    const full = `${lastName}, ${firstName}`.toLowerCase().trim();
    const q = searchQuery.toLowerCase();

    const matchesSearch = full.includes(q) || String(emp.user_id).includes(q);
    const matchesType = typeFilter === 'All' || emp.job_role === typeFilter;

    return matchesSearch && matchesType;
  });

  return (
    <div className="attendance-module">
      {/* RENDER CUSTOM CONFIRMATION MODAL PARA SA DELETE */}
      {recordToDelete && (
        <ConfirmModal
          danger
          title="Delete Record?"
          text="Are you sure you want to permanently delete this attendance record?"
          confirmLabel="Yes, Delete"
          onCancel={() => setRecordToDelete(null)}
          onConfirm={executeDelete}
        />
      )}

      {view === 'list' && (
        <EmployeeListView
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          loading={loading}
          filteredEmployees={filteredEmployees}
          onSelectWorker={handleSelectWorker}
        />
      )}

      {(view === 'log' || view === 'add' || view === 'edit') && (
        <AttendanceLogView
          worker={selectedWorker}
          logLoading={logLoading}
          attendanceLog={attendanceLog}
          logMeta={logMeta}
          logPage={logPage}
          onLogPageChange={setLogPage}
          onAddClick={() => setView('add')}
          onEditClick={(row) => { setEditingRecord(row); setView('edit'); }}
          onDeleteClick={handleDeleteClick}
        />
      )}

      {view === 'add' && (
        <AddAttendanceModal
          worker={selectedWorker}
          showToast={showToast}
          onClose={() => setView('log')}
          onSaved={() => { refetchLog(); setView('log'); }}
        />
      )}

      {view === 'edit' && (
        <EditAttendanceModal
          record={editingRecord}
          showToast={showToast}
          onClose={() => { setView('log'); setEditingRecord(null); }}
          onSaved={() => { refetchLog(); setView('log'); setEditingRecord(null); }}
        />
      )}
    </div>
  );
};

export default Attendance;
