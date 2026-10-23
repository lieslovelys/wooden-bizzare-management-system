import React, { useState, useEffect } from 'react';
import '../css/admin.css';
import AddWorkerModal from './AddWorkerModal';
import EditWorkerModal from './EditWorkerModal';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/format';

const WorkerList = () => {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);

  // Search and Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('Role');
  const [selectedType, setSelectedType] = useState('Type');

  const showToast = useToast();

  const fetchWorkers = async () => {
    try {
      const result = await api.get('/api/workers');
      if (result.success) {
        setWorkers(result.data);
      }
    } catch (error) {
      console.error('Error fetching workers:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  // --- Handlers para sa Modals ---
  // Deliberately no try/catch here (unlike handleUpdateWorker below): AddWorkerModal's own
  // handleSubmit awaits onSave and toasts success only after it resolves. Catching and toasting
  // here too meant a failed add (duplicate username, a validation 400) showed BOTH the error
  // toast and AddWorkerModal's unconditional success toast, and still cleared the form — see
  // ARCHITECTURE_REVIEW.md item 23. AddWorkerModal is the one place this error is handled now.
  const handleSaveNewWorker = async (newWorkerData) => {
    const result = await api.post('/api/workers', newWorkerData);
    if (result.success) {
      setIsAddModalOpen(false);
      fetchWorkers();
    }
  };

  const handleUpdateWorker = async (updatedData) => {
    try {
      const result = await api.put(`/api/workers/${selectedWorker.user_id}`, updatedData);

      if (result.success) {
        showToast("Worker details updated successfully! ", "success");
        setIsEditModalOpen(false);
        fetchWorkers();
      } else {
        // See handleSaveNewWorker above — effectively unreachable under the unified contract.
        showToast("Failed to update worker.", "error");
      }
    } catch (error) {
      console.error('Error updating worker:', error.message);
      showToast(error.message || "An error occurred while updating.", "error");
    }
  };

  const filteredWorkers = workers.filter((worker) => {
    const matchesSearch = 
      worker.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.formatted_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = selectedRole === 'Role' || worker.job_role === selectedRole;
    const matchesType = selectedType === 'Type' || worker.job_type === selectedType;

    return matchesSearch && matchesRole && matchesType;
  });

  return (
    <div className="worker-list-container">

      {/* Search Header Area */}
      <div className="worker-search-header">
        <div className="search-bar">
          <span className="search-icon">
            {/* PINALITAN ANG stroke="white" NG stroke="#D1AA3A" DITO */}
            {/* DESIGN.md §3 rule 10 — icon stroke, 3:1 bar */}
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--color-accent-dark)' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
          <input
            type="text"
            aria-label="Search worker's name"
            placeholder="Search worker's name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="filter-dropdown"
          aria-label="Filter by role"
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
        >
          <option value="Role">Role</option>
          <option value="Carpenter">Carpenter</option>
          <option value="Carver">Carver</option>
          <option value="Liha">Liha</option>
          <option value="Delivery">Delivery</option>
          <option value="Painter">Painter</option>
        </select>
        
        <select
          className="filter-dropdown"
          aria-label="Filter by worker type"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          <option value="Type">Type</option>
          <option value="Regular">Regular</option>
          <option value="Part-Time">Part-Time</option>
        </select>
      </div>

      <div className="worker-banner">
        <h2>WORKER LIST</h2>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: '20px' }}>Loading workers...</p>
      ) : (
        <table className="worker-table wb-card-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>NAME</th>
              <th>TYPE</th>
              <th>ROLE</th>
              <th>CONTACT</th>
              <th>RATE</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {filteredWorkers.length > 0 ? (
              filteredWorkers.map((worker, index) => (
                <tr key={index}>
                  <td data-label="ID" className="fw-bold" style={{ fontWeight: 'normal' }}>{worker.formatted_id}</td>
                  <td data-label="Name" className="fw-bold" style={{ fontWeight: 'normal' }}>{worker.full_name}</td>
                  <td data-label="Type">
                    <span className={`type-badge ${worker.job_type === 'Part-Time' ? 'part-time' : 'regular'}`}>
                      {worker.job_type || 'N/A'}
                    </span>
                  </td>
                  <td data-label="Role" className="fw-bold" style={{ fontWeight: 'normal' }}>{worker.job_role || 'N/A'}</td>
                  <td data-label="Contact" className="fw-bold" style={{ fontWeight: 'normal' }}>{worker.contact || 'N/A'}</td>
                  <td data-label="Rate" className="fw-bold" style={{ fontWeight: 'normal' }}>
                    {worker.rate ? formatCurrency(worker.rate) : ''}
                  </td>
                  <td data-label="Action">
                    <button
                      onClick={() => {
                        setSelectedWorker(worker);
                        setIsEditModalOpen(true);
                      }}
                      aria-label={`Edit ${worker.full_name}`}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-accent-dark)' }}
                    >
                      {/* DESIGN.md §3 rule 10 — icon stroke (currentColor), 3:1 bar */}
                      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>No workers found.</td>
              </tr>
            )}
            {/* Desktop-only height filler for a short result set — DESIGN.md §7#10's mobile card
                conversion hides these, since a stack of empty cards has no equivalent purpose. */}
            {Array.from({ length: Math.max(0, 5 - filteredWorkers.length) }).map((_, i) => (
              <tr key={`blank-${i}`} className="worker-table-filler">
                <td style={{height: '40px'}}></td><td></td><td></td><td></td><td></td><td></td><td></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="add-worker-container">
        <button className="btn-add-worker" onClick={() => setIsAddModalOpen(true)}>
          + Add Worker
        </button>
      </div>

      <AddWorkerModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSave={handleSaveNewWorker} />
      <EditWorkerModal
        key={`${selectedWorker?.user_id ?? 'none'}-${isEditModalOpen}`}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        workerData={selectedWorker}
        onUpdate={handleUpdateWorker}
      />
    </div>
  );
};

export default WorkerList;
