import React, { useState, useEffect } from 'react';

// FIX: Pinalitan ang localhost at ginawang relative path
const API = '/api';

const Attendance = () => {
  const [view, setView] = useState('list');
  const [editingRecord, setEditingRecord] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [attendanceLog, setAttendanceLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logLoading, setLogLoading] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All'); 

  // --- BAGONG STATES PARA SA TOAST AT MODAL ---
  const [toast, setToast] = useState({ visible: false, message: '', type: '' });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type: '' }), 3000);
  };

  useEffect(() => { fetchEmployees(); }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/workers`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.data || data); 
      } else {
        const altRes = await fetch(`${API}/job-orders/workers`);
        if (altRes.ok) {
          const data = await altRes.json();
          setEmployees(data.data || data);
        }
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceLog = async (workerId) => {
    if (!workerId || workerId === 'undefined') { return; }
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
    const targetId = worker.user_id;
    if (!targetId) { return; }
    setSelectedWorker(worker);
    fetchAttendanceLog(targetId); 
    setView('log');
  };

  // --- BINAGONG DELETE LOGIC ---
  const handleDeleteClick = (id) => {
    setRecordToDelete(id);
    setShowConfirmModal(true); // Ipakita ang Custom Modal imbes na window.confirm
  };

  const executeDelete = async () => {
    if (!recordToDelete) return;
    setShowConfirmModal(false);
    try {
      const res = await fetch(`${API}/attendance/${recordToDelete}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete.');
      setAttendanceLog(prev => prev.filter(r => r.id !== recordToDelete));
      showToast("Record deleted successfully!", "success");
    } catch (err) { 
      showToast("Failed to delete record.", "error"); 
    } finally {
      setRecordToDelete(null);
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
    ? `${selectedWorker.last_name ?? ''}, ${selectedWorker.first_name ?? ''} ${selectedWorker.middle_name && selectedWorker.middle_name !== 'None' ? selectedWorker.middle_name.charAt(0) + '.' : ''}`.trim().toUpperCase()
    : '—';

  const workerId = selectedWorker
    ? `W-${String(selectedWorker.user_id).padStart(2, '0')}`
    : '—';

  const getPhotoSrc = (worker) => {
    if (!worker) return null;
    if (worker.photo) return worker.photo; 
    return null;
  };

  const getInitials = (worker) => {
    if (!worker) return '?';
    const f = worker.first_name?.[0] ?? '';
    const l = worker.last_name?.[0] ?? '';
    return `${f}${l}`.toUpperCase() || '?';
  };

  const WorkerAvatar = ({ worker, size = 64, className = '' }) => {
    const [imgError, setImgError] = useState(false);
    const src = getPhotoSrc(worker);
    const style = { width: size, height: size, borderRadius: '16px', objectFit: 'cover', flexShrink: 0, boxShadow: '0 4px 10px rgba(0,0,0,0.1)' };
    if (src && !imgError) {
      return <img src={src} alt="avatar" style={style} className={className} onError={() => setImgError(true)} />;
    }
    return (
      <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fbf5e8', color: '#cca43b', fontWeight: 700, fontSize: size * 0.35 }}>
        {getInitials(worker)}
      </div>
    );
  };

  const EmployeeListView = () => (
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
            placeholder="Search worker's ID or name..."
            className="list-search-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        
        <select 
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
              <div className="att-item" key={emp.user_id} onClick={() => handleSelectWorker(emp)}>
                <div>W-{String(emp.user_id).padStart(2, '0')}</div>
                <div>{`${emp.last_name}, ${emp.first_name} ${emp.middle_name && emp.middle_name !== 'None' ? emp.middle_name : ''}`.toUpperCase()}</div>
                <div>{emp.job_role}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  const AttendanceLogView = () => (
    <div>
      <div className="attendance-log-header">
        <WorkerAvatar worker={selectedWorker} size={150} /> 
        <div className="attendance-log-info-stack">
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

      <div>
        <div className="attendance-log-title">
          <h3>ATTENDANCE LOG</h3>
          <button onClick={() => setView('add')} className="attendance-log-add-btn">
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
              <div style={{ textAlign: 'center' }}>Actions</div>
            </div>

            {attendanceLog.length === 0 ? (
              <div style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>No attendance records.</div>
            ) : (
              attendanceLog.map(row => (
                <div className="log-item" key={row.id}>
                  <div>{row.day_of_week?.trim()}</div>
                  <div>{fmtDate(row.date)}</div>
                  <div>{fmt12(row.time_in)}</div>
                  <div>{fmt12(row.time_out)}</div>
                  <div className="attendance-log-actions" style={{ justifyContent: 'center' }}>
                    <button className="attendance-log-edit-btn" onClick={() => { setEditingRecord(row); setView('edit'); }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                      Edit
                    </button>
                    <button className="attendance-log-delete-btn" onClick={() => handleDeleteClick(row.id)}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );

  const AddAttendanceModal = () => { 
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
        const res = await fetch(`${API}/attendance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            worker_id: selectedWorker.user_id, 
            date: formData.date,
            day_of_week: formData.day_of_week,
            time_in: formData.time_in || null,
            time_out: formData.time_out || null,
          }),
        });
        if (!res.ok) throw new Error('Failed to add attendance.');
        await fetchAttendanceLog(selectedWorker.user_id);
        
        showToast('Attendance added successfully!', 'success'); // Toast Success
        setView('log');
      } catch (err) { showToast(err.message, 'error'); } // Toast Error
      finally { setSaving(false); }
    };

    return (
      <div className="custom-modal-overlay" onClick={() => setView('log')}>
        <div className="custom-modal-content" onClick={e => e.stopPropagation()}>
          <h3 className="custom-modal-title">Add Attendance</h3>
          
          <div className="custom-modal-grid">
            <div className="custom-form-group">
              <label>Date</label>
              <input type="date" value={formData.date} onChange={handleDateChange} />
            </div>
            <div className="custom-form-group">
              <label>Day</label>
              <input type="text" value={formData.day_of_week} readOnly className="read-only-input" />
            </div>
            <div className="custom-form-group">
              <label>Time In</label>
              <input type="time" value={formData.time_in} onChange={e => setFormData({ ...formData, time_in: e.target.value })} />
            </div>
            <div className="custom-form-group">
              <label>Time Out</label>
              <input type="time" value={formData.time_out} onChange={e => setFormData({ ...formData, time_out: e.target.value })} />
            </div>
          </div>

          <div className="custom-modal-actions">
            <button className="custom-modal-btn cancel" onClick={() => setView('log')}>Cancel</button>
            <button className="custom-modal-btn" onClick={handleAdd} disabled={saving}>{saving ? 'Adding...' : 'Add Record'}</button>
          </div>
        </div>
      </div>
    );
  };

  const EditAttendanceModal = () => { 
    const [formData, setFormData] = useState({
      date: editingRecord?.date?.slice(0, 10) ?? '',
      day_of_week: editingRecord?.day_of_week?.trim() ?? '—',
      time_in: editingRecord?.time_in?.slice(0, 5) ?? '',
      time_out: editingRecord?.time_out?.slice(0, 5) ?? '',
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
        await fetchAttendanceLog(selectedWorker.user_id);
        
        showToast('Attendance updated successfully!', 'success'); // Toast Success
        setView('log');
        setEditingRecord(null);
      } catch (err) { showToast(err.message, 'error'); } // Toast Error
      finally { setSaving(false); }
    };

    return (
      <div className="custom-modal-overlay" onClick={() => setView('log')}>
        <div className="custom-modal-content" onClick={e => e.stopPropagation()}>
          <h3 className="custom-modal-title">Edit Attendance</h3>
          
          <div className="custom-modal-grid">
            <div className="custom-form-group">
              <label>Date</label>
              <input type="date" value={formData.date} onChange={handleDateChange} />
            </div>
            <div className="custom-form-group">
              <label>Day</label>
              <input type="text" value={formData.day_of_week} readOnly className="read-only-input" />
            </div>
            <div className="custom-form-group">
              <label>Time In</label>
              <input type="time" value={formData.time_in} onChange={e => setFormData({ ...formData, time_in: e.target.value })} />
            </div>
            <div className="custom-form-group">
              <label>Time Out</label>
              <input type="time" value={formData.time_out} onChange={e => setFormData({ ...formData, time_out: e.target.value })} />
            </div>
          </div>

          <div className="custom-modal-actions">
            <button className="custom-modal-btn cancel" onClick={() => { setView('log'); setEditingRecord(null); }}>Cancel</button>
            <button className="custom-modal-btn" onClick={handleUpdate} disabled={saving}>{saving ? 'Updating...' : 'Save Changes'}</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="attendance-module">
      {/* RENDER TOAST KUNG VISIBLE */}
      {toast.visible && (
        <div className="wb-toast-container">
            <div className={`wb-toast ${toast.type}`}>
                {toast.type === 'success' ? '' : ''} {toast.message}
            </div>
        </div>
      )}

      {/* RENDER CUSTOM CONFIRMATION MODAL PARA SA DELETE */}
      {showConfirmModal && (
        <div className="wb-modal-overlay">
            <div className="wb-modal-box">
                <h3 className="wb-modal-title" style={{color: '#C62828'}}>Delete Record?</h3>
                <p className="wb-modal-text">
                    Are you sure you want to permanently delete this attendance record?
                </p>
                <div className="wb-modal-actions">
                    <button className="wb-btn-no" onClick={() => setShowConfirmModal(false)}>Cancel</button>
                    <button 
                        className="wb-btn-yes" 
                        style={{ backgroundColor: '#C62828' }} 
                        onClick={executeDelete}
                    >
                        Yes, Delete
                    </button>
                </div>
            </div>
        </div>
      )}

      {view === 'list' && <EmployeeListView />}
      {view === 'log' && <AttendanceLogView />}
      {view === 'add' && <><AttendanceLogView /><AddAttendanceModal /></>}
      {view === 'edit' && <><AttendanceLogView /><EditAttendanceModal /></>}
    </div>
  );
};

export default Attendance;
