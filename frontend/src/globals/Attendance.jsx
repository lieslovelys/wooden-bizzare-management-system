import React, { useState } from 'react';

const Attendance = () => {
  const [view, setView] = useState('list');
  const [editingIndex, setEditingIndex] = useState(null);

  const employees = [
    { id: 'WB-0012', name: 'CANARIA, CHARLES KIRBY', type: 'Carpenter' },
    { id: 'WB-0013', name: 'ESPANOL, JAYSON', type: 'Delivery' },
    { id: 'WB-0014', name: 'ESPONILLA, ALYSSA MAE', type: 'Quality Control' },
    { id: 'WB-0016', name: 'JURALBAL, JOHN KENNETH', type: 'Painter' },
    { id: 'WB-0083', name: 'LOYOLA, JOHN CARL', type: 'Delivery' },
  ];

  const [attendanceLog, setAttendanceLog] = useState([
    { day: 'Monday', date: '4/1/26', in: '8:30 AM', out: '5:00 PM' },
    { day: 'Tuesday', date: '4/2/26', in: '8:30 AM', out: '5:00 PM' },
    { day: 'Wednesday', date: '4/3/26', in: '7:30 AM', out: '5:00 PM' },
  ]);

  const deleteAttendance = (index) => {
    setAttendanceLog(attendanceLog.filter((_, i) => i !== index));
  };

  const EmployeeListView = () => (
    <div className="attendance-container">
      <h1 className="attendance-title">LIST OF EMPLOYEES</h1>
      <div className="attendance-divider" />

      <div className="attendance-search">
        <span className="attendance-search-icon">🔍</span>
        <input 
          type="text" 
          placeholder="Search employee's name or type..." 
          className="attendance-search-input"
        />
      </div>

      <table className="attendance-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Type</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, i) => (
            <tr key={i} onClick={() => setView('log')}>
              <td>{emp.id}</td>
              <td>{emp.name}</td>
              <td>{emp.type}</td>
              <td>
                <button className="attendance-delete-btn" onClick={(e) => { e.stopPropagation(); }}>🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const AttendanceLogView = () => (
    <div className="attendance-log-container">
      <div className="attendance-log-header">
        <img 
          src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400" 
          className="attendance-log-img" 
          alt="profile" 
        />
        <div className="attendance-log-info">
          <div className="attendance-log-card">
            <h2 className="attendance-log-name">ESPANOL, JAYSON B.</h2>
            <span className="attendance-log-id">WB-0013</span>
          </div>
          <div className="attendance-log-card">
            <h3 className="attendance-log-role">Delivery</h3>
            <p className="attendance-log-type">Regular</p>
          </div>
        </div>
      </div>

      <div className="attendance-log-section">
        <div className="attendance-log-title">
          <h3>Attendance Log</h3>
          <button onClick={() => setView('add')} className="attendance-log-add-btn">+ Add attendance</button>
        </div>

        <div className="attendance-log-table">
          <table className="attendance-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Date</th>
                <th>Time In</th>
                <th>Time Out</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {attendanceLog.map((row, i) => (
                <tr key={i}>
                  <td>{row.day}</td>
                  <td>{row.date}</td>
                  <td>{row.in}</td>
                  <td>{row.out}</td>
                  <td className="attendance-log-actions">
                    <button onClick={() => { setEditingIndex(i); setView('edit'); }} className="attendance-log-edit-btn">✎</button>
                    <button onClick={() => deleteAttendance(i)} className="attendance-log-delete-btn">🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const AddAttendanceModal = () => {
    const [formData, setFormData] = useState({
      day: 'Monday',
      date: '2026-04-04',
      in: '08:00',
      out: '17:00'
    });

    const formatTime = (time) => {
      const [hours, minutes] = time.split(':');
      const h = parseInt(hours);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${h12}:${minutes} ${ampm}`;
    };

    const formatDate = (dateStr) => {
      const date = new Date(dateStr);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const year = date.getFullYear().toString().slice(-2);
      return `${month}/${day}/${year}`;
    };

    const handleAdd = () => {
      const newEntry = {
        day: formData.day,
        date: formatDate(formData.date),
        in: formatTime(formData.in),
        out: formatTime(formData.out)
      };
      setAttendanceLog([...attendanceLog, newEntry]);
      setView('log');
    };

    return (
      <div className="attendance-modal-overlay" onClick={() => setView('log')}>
        <div className="attendance-modal attendance-modal-lg" onClick={(e) => e.stopPropagation()}>
          <h3 className="attendance-modal-title">Add attendance</h3>

          <div className="attendance-form-grid">
            <div className="attendance-form-field">
              <label className="attendance-form-label">Date</label>
              <div className="attendance-form-row">
                <input 
                  type="date" 
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="attendance-form-input" 
                />
              </div>
            </div>
            <div className="attendance-form-field">
              <label className="attendance-form-label">Day</label>
              <div className="attendance-form-row">
                <select 
                  value={formData.day}
                  onChange={(e) => setFormData({...formData, day: e.target.value})}
                  className="attendance-form-select"
                >
                  <option value="Monday">Monday</option>
                  <option value="Tuesday">Tuesday</option>
                  <option value="Wednesday">Wednesday</option>
                  <option value="Thursday">Thursday</option>
                  <option value="Friday">Friday</option>
                  <option value="Saturday">Saturday</option>
                  <option value="Sunday">Sunday</option>
                </select>
              </div>
            </div>
            
            <div className="attendance-form-field">
              <label className="attendance-form-label">Time In</label>
              <div className="attendance-form-row">
                <input 
                  type="time" 
                  value={formData.in}
                  onChange={(e) => setFormData({...formData, in: e.target.value})}
                  className="attendance-form-input" 
                />
              </div>
            </div>
            <div className="attendance-form-field">
              <label className="attendance-form-label">Time Out</label>
              <div className="attendance-form-row">
                <input 
                  type="time" 
                  value={formData.out}
                  onChange={(e) => setFormData({...formData, out: e.target.value})}
                  className="attendance-form-input" 
                />
              </div>
            </div>
          </div>

          <div className="attendance-modal-actions">
            <button onClick={() => setView('log')} className="attendance-modal-cancel">Cancel</button>
            <button onClick={handleAdd} className="attendance-modal-update">Add</button>
          </div>
        </div>
      </div>
    );
  };

  const EditAttendanceModal = () => {
    const currentData = attendanceLog[editingIndex] || { day: 'Monday', date: '2026-04-01', in: '08:30', out: '5:00 PM' };
    
    const [formData, setFormData] = useState({
      day: currentData.day,
      date: currentData.date,
      in: currentData.in,
      out: currentData.out
    });

    const formatTime = (time) => {
      if (time.includes('AM') || time.includes('PM')) {
        const [t, ampm] = time.split(' ');
        const [h, m] = t.split(':');
        let hours = parseInt(h);
        if (ampm === 'PM' && hours !== 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        return `${hours.toString().padStart(2, '0')}:${m}`;
      }
      return time;
    };

    const formatDateDisplay = (dateStr) => {
      const date = new Date(dateStr);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const year = date.getFullYear().toString().slice(-2);
      return `${month}/${day}/${year}`;
    };

    const handleUpdate = () => {
      const updatedLog = [...attendanceLog];
      updatedLog[editingIndex] = {
        day: formData.day,
        date: formatDateDisplay(formData.date),
        in: formatTime(formData.in),
        out: formatTime(formData.out)
      };
      setAttendanceLog(updatedLog);
      setView('log');
      setEditingIndex(null);
    };

    return (
      <div className="attendance-modal-overlay" onClick={() => setView('log')}>
        <div className="attendance-modal attendance-modal-lg" onClick={(e) => e.stopPropagation()}>
          <h3 className="attendance-modal-title">Edit attendance</h3>

          <div className="attendance-form-grid">
            <div className="attendance-form-field">
              <label className="attendance-form-label">Date</label>
              <div className="attendance-form-row">
                <input 
                  type="date" 
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="attendance-form-input" 
                />
              </div>
            </div>
            <div className="attendance-form-field">
              <label className="attendance-form-label">Day</label>
              <div className="attendance-form-row">
                <select 
                  value={formData.day}
                  onChange={(e) => setFormData({...formData, day: e.target.value})}
                  className="attendance-form-select"
                >
                  <option value="Monday">Monday</option>
                  <option value="Tuesday">Tuesday</option>
                  <option value="Wednesday">Wednesday</option>
                  <option value="Thursday">Thursday</option>
                  <option value="Friday">Friday</option>
                  <option value="Saturday">Saturday</option>
                  <option value="Sunday">Sunday</option>
                </select>
              </div>
            </div>
            
            <div className="attendance-form-field">
              <label className="attendance-form-label">Time In</label>
              <div className="attendance-form-row">
                <input 
                  type="time" 
                  value={formatTime(formData.in)}
                  onChange={(e) => setFormData({...formData, in: e.target.value})}
                  className="attendance-form-input" 
                />
              </div>
            </div>
            <div className="attendance-form-field">
              <label className="attendance-form-label">Time Out</label>
              <div className="attendance-form-row">
                <input 
                  type="time" 
                  value={formatTime(formData.out)}
                  onChange={(e) => setFormData({...formData, out: e.target.value})}
                  className="attendance-form-input" 
                />
              </div>
            </div>
          </div>

          <div className="attendance-modal-actions">
            <button onClick={() => { setView('log'); setEditingIndex(null); }} className="attendance-modal-cancel">Cancel</button>
            <button onClick={handleUpdate} className="attendance-modal-update">Update</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 bg-white min-h-screen font-sans" style={{ fontFamily: "'Georgia', serif" }}>
      {view === 'list' && <EmployeeListView />}
      {view === 'log' && <AttendanceLogView />}
      {view === 'add' && (
        <>
          <AttendanceLogView />
          <AddAttendanceModal />
        </>
      )}
      {view === 'edit' && (
        <>
          <AttendanceLogView />
          <EditAttendanceModal />
        </>
      )}
    </div>
  );
};

export default Attendance;