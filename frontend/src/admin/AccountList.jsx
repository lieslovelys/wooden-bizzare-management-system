import React, { useState, useEffect } from 'react';
import '../css/admin.css'; 

const AccountList = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeRowId, setActiveRowId] = useState(null); 

  // --- BAGONG STATES PARA SA POP-UPS ---
  const [toast, setToast] = useState({ visible: false, message: '', type: '' });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type: '' }), 3000);
  };

  const fetchAccounts = async () => {
    try {
      // FIX 1: Tinanggal ang localhost at ginawang relative path
      const response = await fetch('/users');
      const result = await response.json();
      if (result.success) {
        setAccounts(result.data);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // --- BINAGONG DELETE FUNCTION: Papalabasin lang muna yung Modal ---
  const handleDeleteClick = (id, name, e) => {
    e.stopPropagation(); 
    setAccountToDelete({ id, name }); // I-save kung sino yung buburahin
    setShowConfirmModal(true); // Ipakita yung modal
  };

  // --- ITO YUNG MAG-EEXECUTE KAPAG NAG-YES SA MODAL ---
  const executeDelete = async () => {
    if (!accountToDelete) return;
    
    setShowConfirmModal(false); // Itago yung modal
    
    try {
      // FIX 2: Tinanggal ang localhost dito sa DELETE request
      const response = await fetch(`/users/${accountToDelete.id}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (result.success) {
        showToast('Account deleted successfully!', 'success');
        fetchAccounts(); // I-refresh ang listahan
      } else {
        showToast('Failed to delete user.', 'error');
      }
    } catch (error) {
      console.error('Delete error:', error);
      showToast('An error occurred while deleting.', 'error');
    } finally {
      setAccountToDelete(null); // I-clear state
    }
  };

  return (
    <div className="account-list">
      
      {/* RENDER TOAST KUNG VISIBLE */}
      {toast.visible && (
        <div className="wb-toast-container">
            <div className={`wb-toast ${toast.type}`}>
                {toast.type === 'success' ? '' : ''} {toast.message}
            </div>
        </div>
      )}

      {/* RENDER CUSTOM CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="wb-modal-overlay">
            <div className="wb-modal-box">
                <h3 className="wb-modal-title" style={{color: '#C62828'}}>Delete Account?</h3>
                <p className="wb-modal-text">
                    Are you sure you want to permanently delete the account of <strong>{accountToDelete?.name}</strong>?
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

      <div className="account-list-container">
        {loading ? (
          <p style={{ textAlign: 'center', padding: '20px' }}>Loading accounts...</p>
        ) : (
          <div className="al-grid-wrapper">
            
            {/* --- GRID HEADER --- */}
            <div className="al-header">
              <div className="al-col">ID</div>
              <div className="al-col">Name</div>
              <div className="al-col">Account Role</div>
              <div className="al-col">Username</div>
              <div className="al-col action-col">Action</div>
            </div>

            {/* --- GRID ITEMS (CARDS) --- */}
            <div className="al-list">
              {accounts.length > 0 ? (
                accounts.map((account) => (
                  <div 
                    key={account.user_id}
                    onClick={() => setActiveRowId(account.user_id)}
                    className={`al-item ${activeRowId === account.user_id ? 'active' : ''}`}
                  >
                    <div className="al-col id-col">{account.formatted_id}</div>
                    <div className="al-col name-col">{account.full_name}</div>
                    
                    {/* Role Badge */}
                    <div className="al-col">
                      <span className={`al-role-badge ${account.user_role ? account.user_role.toLowerCase() : ''}`}>
                        {account.user_role}
                      </span>
                    </div>
                    
                    <div className="al-col">{account.username}</div>
                    
                    {/* Action Button */}
                    <div className="al-col action-col">
                      <button 
                        className="delete-btn" 
                        onClick={(e) => handleDeleteClick(account.user_id, account.full_name, e)} 
                        title="Delete Account"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="trash-icon">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '30px', color: '#8b816a', backgroundColor: '#ffffff', borderRadius: '12px' }}>
                  No accounts found.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountList;