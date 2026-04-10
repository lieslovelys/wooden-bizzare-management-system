import React, { useState, useEffect } from 'react';
import '../css/admin.css';
import AddWorkerModal from './AddWorkerModal'; 
import EditWorkerModal from './EditWorkerModal';

const WorkerList = () => {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);

  // --- BAGONG STATES PARA SA SEARCH AT FILTERS ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('Role');
  const [selectedType, setSelectedType] = useState('Type');

  const fetchWorkers = async () => {
    try {
      const response = await fetch('http://localhost:8080/workers');
      const result = await response.json();
      if (result.success) {
        setWorkers(result.data);
      }
    } catch (error) {
      console.error('Error fetching workers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  // --- Handlers para sa Modals ---
const handleSaveNewWorker = async (newWorkerData) => {
    try {
      const response = await fetch('http://localhost:8080/workers', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWorkerData), 
      });
      const result = await response.json();
      
      if (result.success) {
        alert("✅ Worker successfully added to database!"); // <-- Binalik ang success message
        setIsAddModalOpen(false); 
        fetchWorkers(); 
      } else {
        alert("❌ Failed to add worker: " + result.message); // <-- Dagdag na rin natin yung error message para sure
      }
    } catch (error) {
      console.error('Error saving worker:', error);
      alert("❌ An error occurred while saving.");
    }
  };

const handleUpdateWorker = async (updatedData) => {
    try {
      const response = await fetch(`http://localhost:8080/workers/${selectedWorker.user_id}`, {
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData), 
      });
      const result = await response.json();
      
      if (result.success) {
        alert("✅ Worker details updated successfully!"); // <-- Binalik ang success message
        setIsEditModalOpen(false);
        fetchWorkers();
      } else {
        alert("❌ Failed to update worker: " + result.message);
      }
    } catch (error) {
      console.error('Error updating worker:', error);
      alert("❌ An error occurred while updating.");
    }
  };

  // --- LOGIC PARA SA SEARCH AT FILTER ---
  const filteredWorkers = workers.filter((worker) => {
    // Check kung nagma-match sa search (Name o ID)
    const matchesSearch = 
      worker.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.formatted_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Check kung nagma-match sa Role dropdown
    const matchesRole = selectedRole === 'Role' || worker.job_role === selectedRole;
    
    // Check kung nagma-match sa Type dropdown
    const matchesType = selectedType === 'Type' || worker.job_type === selectedType;

    return matchesSearch && matchesRole && matchesType;
  });

  return (
    // Ibinalot ko sa div na may style para maging Arial lahat
    <div className="worker-list-container" style={{ fontFamily: 'Arial, sans-serif' }}>
      
      {/* Search Header Area */}
      <div className="worker-search-header">
        <div className="search-bar">
          <span className="search-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
          {/* Nakakonekta na sa state yung input */}
          <input 
            type="text" 
            placeholder="Search worker's name" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {/* Nakakonekta na sa state yung mga dropdown */}
        <select 
          className="filter-dropdown" 
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
        <table className="worker-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>NAME</th>
              <th>TYPE</th>
              <th>ROLE</th>
              <th>CONTACT</th>
              <th>RATE</th>
              <th>ACTION</th> {/* Iniwan ko to para sa Edit */}
            </tr>
          </thead>
          <tbody>
            {filteredWorkers.length > 0 ? (
              // Ginamit natin yung 'filteredWorkers' imbes na 'workers'
              filteredWorkers.map((worker, index) => (
                <tr key={index}>
                  <td className="fw-bold" style={{ fontWeight: 'normal' }}>{worker.formatted_id}</td>
                  <td className="fw-bold" style={{ fontWeight: 'normal' }}>{worker.full_name}</td>
                  <td>
                    <span className={`type-badge ${worker.job_type === 'Part-Time' ? 'part-time' : 'regular'}`}>
                      {worker.job_type || 'N/A'}
                    </span>
                  </td>
                  <td className="fw-bold" style={{ fontWeight: 'normal' }}>{worker.job_role || 'N/A'}</td>
                  <td className="fw-bold" style={{ fontWeight: 'normal' }}>{worker.contact || 'N/A'}</td>
                  <td className="fw-bold" style={{ fontWeight: 'normal' }}>
                    {worker.rate ? `₱ ${parseFloat(worker.rate).toFixed(2)}` : ''}
                  </td>
                  <td>
                    <button 
                      onClick={() => {
                        setSelectedWorker(worker);
                        setIsEditModalOpen(true);
                      }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#D1AA3A' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>No workers found.</td>
              </tr>
            )}
            {/* Dagdag na blank rows para mapunan yung table space tulad ng sa picture */}
            {Array.from({ length: Math.max(0, 5 - filteredWorkers.length) }).map((_, i) => (
              <tr key={`blank-${i}`}>
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
      <EditWorkerModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} workerData={selectedWorker} onUpdate={handleUpdateWorker} />
    </div>
  );
};

export default WorkerList;