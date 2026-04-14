// Attendance.jsx
import React, { useState, useEffect } from 'react';

const API = 'http://localhost:8080/api';

const Attendance = () => {
  const [view, setView] = useState('list');
  const [editingRecord, setEditingRecord] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [attendanceLog, setAttendanceLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logLoading, setLogLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { fetchEmployees(); }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/workers`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      } else {
        const altRes = await fetch(`${API}/job-orders/workers`);
        if (altRes.ok) {
          const data = await altRes.json();
          setEmployees(data);
        }
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceLog = async (workerId) => {
    try {
      setLogLoading(true);
      const res = await fetch(`${API}/attendance/worker/${workerId}`);
      const data = await res.json();
      setAttendanceLog(data);
    } catch (err) {
      console.error('Error fetching attendance:', err);
    } finally {
      setLogLoading(false);
    }
  };

  const handleSelectWorker = (worker) => {
    setSelectedWorker(worker);
    fetchAttendanceLog(worker.detail_id);
    setView('log');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this attendance record?')) return;
    try {
      const res = await fetch(`${API}/attendance/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete.');
      setAttendanceLog(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error(err);
      alert('Failed to delete record.');
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const firstName = emp.first_name ?? '';
    const lastName = emp.last_name ?? '';
    const jobRole = emp.job_role ?? '';
    const full = `${lastName} ${firstName}`.toLowerCase().trim();
    const role = jobRole.toLowerCase();
    const q = searchQuery.toLowerCase();
    return full.includes(q) || role.includes(q);
  });

  const fmt12 = (t) => {
    if (!t) return '—';
    const [h, m] = t.slice(0, 5).split(':');
    const hours = parseInt(h);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    return `${hours % 12 || 12}:${m} ${ampm}`;
  };

  const fmtDate = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    return `${dt.getMonth() + 1}/${dt.getDate()}/${String(dt.getFullYear()).slice(-2)}`;
  };

  const workerLabel = selectedWorker
    ? `${selectedWorker.last_name ?? ''}, ${selectedWorker.first_name ?? ''} ${selectedWorker.middle_name ?? ''}`.trim()
    : '—';

  const workerId = selectedWorker
    ? `WB-${String(selectedWorker.detail_id).padStart(4, '0')}`
    : '—';

  // ── Resolve photo: use worker's photo field, fallback to initials avatar ──
  const getPhotoSrc = (worker) => {
    if (!worker) return null;
    if (worker.photo) return worker.photo; // URL or path stored in DB
    return null;
  };

  const getInitials = (worker) => {
    if (!worker) return '?';
    const f = worker.first_name?.[0] ?? '';
    const l = worker.last_name?.[0] ?? '';
    return `${f}${l}`.toUpperCase() || '?';
  };

  // ── Worker photo avatar component (used in list + log views) ──
  const WorkerAvatar = ({ worker, size = 64, className = '' }) => {
    const [imgError, setImgError] = useState(false);
    const src = getPhotoSrc(worker);

    const style = {
      width: size,
      height: size,
      borderRadius: '50%',
      objectFit: 'cover',
      flexShrink: 0,
    };

    if (src && !imgError) {
      return (
        <img
          src={src}
          alt={`${worker?.first_name ?? ''} ${worker?.last_name ?? ''}`}
          style={style}
          className={`attendance-log-img ${className}`}
          onError={() => setImgError(true)}
        />
      );
    }

    // Fallback: initials circle
    return (
      <div
        className={`attendance-avatar-fallback ${className}`}
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#d1d5db',
          color: '#374151',
          fontWeight: 700,
          fontSize: size * 0.35,
          letterSpacing: 1,
          userSelect: 'none',
        }}
      >
        {getInitials(worker)}
      </div>
    );
  };

  const EmployeeListView = () => (
    <div className="attendance-container">
      <h1 className="attendance-title">LIST OF EMPLOYEES</h1>
      <div className="attendance-divider" />
      <div className="attendance-search">
        <input
          type="text"
          placeholder="Search employee's name or type..."
          className="attendance-search-input"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>
      {loading ? (
        <p style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Loading employees...</p>
      ) : (
        <table className="attendance-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Photo</th>
              <th>Name</th>
              <th>Type</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', opacity: 0.5 }}>No employees found.</td>
              </tr>
            ) : (
              filteredEmployees.map(emp => (
                <tr key={emp.detail_id} onClick={() => handleSelectWorker(emp)} style={{ cursor: 'pointer' }}>
                  <td>WB-{String(emp.detail_id).padStart(4, '0')}</td>
                  <td>
                    <WorkerAvatar worker={emp} size={36} />
                  </td>
                  <td>{emp.last_name}, {emp.first_name} {emp.middle_name ?? ''}</td>
                  <td>{emp.job_role}</td>
                  <td>
                    <button className="attendance-delete-btn" onClick={e => e.stopPropagation()}>🗑</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );

  const AttendanceLogView = () => (
    <div className="attendance-log-container">
      <div className="attendance-log-header">

        {/* ── UPDATED: dynamic photo with initials fallback ── */}
        <WorkerAvatar worker={selectedWorker} size={80} />

        <div className="attendance-log-info">
          <div className="attendance-log-card">
            <h2 className="attendance-log-name">{workerLabel}</h2>
            <span className="attendance-log-id">{workerId}</span>
          </div>
          <div className="attendance-log-card">
            <h3 className="attendance-log-role">{selectedWorker?.job_role ?? '—'}</h3>
            <p className="attendance-log-type">{selectedWorker?.job_type ?? '—'}</p>
          </div>
        </div>
      </div>

      <div className="attendance-log-section">
        <div className="attendance-log-title">
          <h3>ATTENDANCE LOG</h3>
          <button onClick={() => setView('add')} className="attendance-log-add-btn">+ Add attendance</button>
        </div>
        <div className="attendance-log-table">
          {logLoading ? (
            <p style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Loading log...</p>
          ) : (
            <table className="attendance-log-table-grid">
              <thead>
                <tr>
                  <th>DAY</th>
                  <th>DATE</th>
                  <th>TIME IN</th>
                  <th>TIME OUT</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {attendanceLog.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', opacity: 0.5 }}>No attendance records.</td>
                  </tr>
                ) : (
                  attendanceLog.map(row => (
                    <tr key={row.id}>
                      <td>{row.day_of_week?.trim()}</td>
                      <td>{fmtDate(row.date)}</td>
                      <td>{fmt12(row.time_in)}</td>
                      <td>{fmt12(row.time_out)}</td>
                      <td className="attendance-log-actions">
                        <button className="attendance-log-edit-btn" onClick={() => { setEditingRecord(row); setView('edit'); }}>✏️</button>
                        <button className="attendance-log-delete-btn" onClick={() => handleDelete(row.id)}>🗑</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );

  const AddAttendanceModal = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const getDayFromDate = (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return days[d.getDay()];
    };
    const [formData, setFormData] = useState({ date: '', time_in: '08:00', time_out: '17:00' });
    const [saving, setSaving] = useState(false);

    const selectedDay = getDayFromDate(formData.date);

    const handleAdd = async () => {
      if (!formData.date) { alert('Date is required.'); return; }
      setSaving(true);
      try {
        const res = await fetch(`${API}/attendance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            worker_id: selectedWorker.detail_id,
            date: formData.date,
            day_of_week: selectedDay,
            time_in: formData.time_in || null,
            time_out: formData.time_out || null,
          }),
        });
        if (!res.ok) throw new Error('Failed to add attendance.');
        await fetchAttendanceLog(selectedWorker.detail_id);
        setView('log');
      } catch (err) { alert(err.message); }
      finally { setSaving(false); }
    };

    return (
      <div className="attendance-modal-overlay" onClick={() => setView('log')}>
        <div className="attendance-modal attendance-modal-lg" onClick={e => e.stopPropagation()}>
          <h3 className="attendance-modal-title">Add attendance</h3>
          <div className="attendance-form-grid">
            <div className="attendance-form-field">
              <label className="attendance-form-label">Day</label>
              <input type="text" value={selectedDay} className="attendance-form-input" readOnly />
            </div>
            <div className="attendance-form-field">
              <label className="attendance-form-label">Date</label>
              <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="attendance-form-input" />
            </div>
          </div>
          <div className="attendance-form-grid">
            <div className="attendance-form-field">
              <label className="attendance-form-label">Time In</label>
              <input type="time" value={formData.time_in} onChange={e => setFormData({ ...formData, time_in: e.target.value })} className="attendance-form-input" />
            </div>
            <div className="attendance-form-field">
              <label className="attendance-form-label">Time Out</label>
              <input type="time" value={formData.time_out} onChange={e => setFormData({ ...formData, time_out: e.target.value })} className="attendance-form-input" />
            </div>
          </div>
          <div className="attendance-modal-actions">
            <button onClick={() => setView('log')} className="attendance-modal-cancel">Cancel</button>
            <button onClick={handleAdd} className="attendance-modal-update" disabled={saving}>{saving ? 'Adding...' : 'Add'}</button>
          </div>
        </div>
      </div>
    );
  };

  const EditAttendanceModal = () => {
    const [formData, setFormData] = useState({
      date: editingRecord?.date?.slice(0, 10) ?? '',
      time_in: editingRecord?.time_in?.slice(0, 5) ?? '',
      time_out: editingRecord?.time_out?.slice(0, 5) ?? '',
    });
    const [saving, setSaving] = useState(false);

    const handleUpdate = async () => {
      if (!formData.date) { alert('Date is required.'); return; }
      setSaving(true);
      try {
        const res = await fetch(`${API}/attendance/${editingRecord.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: formData.date,
            time_in: formData.time_in || null,
            time_out: formData.time_out || null,
          }),
        });
        if (!res.ok) throw new Error('Failed to update attendance.');
        await fetchAttendanceLog(selectedWorker.detail_id);
        setView('log');
        setEditingRecord(null);
      } catch (err) { alert(err.message); }
      finally { setSaving(false); }
    };

    return (
      <div className="attendance-modal-overlay" onClick={() => setView('log')}>
        <div className="attendance-modal attendance-modal-lg" onClick={e => e.stopPropagation()}>
          <h3 className="attendance-modal-title">Edit attendance</h3>
          <div className="attendance-form-grid">
            <div className="attendance-form-field">
              <label className="attendance-form-label">Date</label>
              <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="attendance-form-input" />
            </div>
          </div>
          <div className="attendance-form-grid">
            <div className="attendance-form-field">
              <label className="attendance-form-label">Time In</label>
              <input type="time" value={formData.time_in} onChange={e => setFormData({ ...formData, time_in: e.target.value })} className="attendance-form-input" />
            </div>
            <div className="attendance-form-field">
              <label className="attendance-form-label">Time Out</label>
              <input type="time" value={formData.time_out} onChange={e => setFormData({ ...formData, time_out: e.target.value })} className="attendance-form-input" />
            </div>
          </div>
          <div className="attendance-modal-actions">
            <button onClick={() => { setView('log'); setEditingRecord(null); }} className="attendance-modal-cancel">Cancel</button>
            <button onClick={handleUpdate} className="attendance-modal-update" disabled={saving}>{saving ? 'Updating...' : 'Update'}</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 bg-white min-h-screen" style={{ fontFamily: "'Georgia', serif" }}>
      {view === 'list' && <EmployeeListView />}
      {view === 'log' && <AttendanceLogView />}
      {view === 'add' && <><AttendanceLogView /><AddAttendanceModal /></>}
      {view === 'edit' && <><AttendanceLogView /><EditAttendanceModal /></>}
    </div>
  );
};

export default Attendance;