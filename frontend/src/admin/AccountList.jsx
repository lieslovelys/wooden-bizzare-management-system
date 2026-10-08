import React, { useState, useEffect } from 'react';
import '../css/admin.css';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../globals/ConfirmModal';
import { clickableProps } from '../utils/a11y';

const AccountList = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeRowId, setActiveRowId] = useState(null);

  // accountToDelete being non-null is what opens the modal — no separate boolean needed.
  const [accountToDelete, setAccountToDelete] = useState(null);

  const showToast = useToast();

  const fetchAccounts = async () => {
    try {
      const result = await api.get('/api/users');
      if (result.success) {
        setAccounts(result.data);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error.message);
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
  };

  // --- ITO YUNG MAG-EEXECUTE KAPAG NAG-YES SA MODAL ---
  const executeDelete = async () => {
    if (!accountToDelete) return;
    const { id } = accountToDelete;
    setAccountToDelete(null); // Itago yung modal

    try {
      const result = await api.delete(`/api/users/${id}`);

      if (result.success) {
        showToast('Account deleted successfully!', 'success');
        fetchAccounts(); // I-refresh ang listahan
      } else {
        showToast('Failed to delete user.', 'error');
      }
    } catch (error) {
      console.error('Delete error:', error.message);
      showToast(error.message || 'An error occurred while deleting.', 'error');
    }
  };

  return (
    <div className="account-list">

      {/* RENDER CUSTOM CONFIRMATION MODAL */}
      {accountToDelete && (
        <ConfirmModal
          danger
          title="Delete Account?"
          confirmLabel="Yes, Delete"
          onCancel={() => setAccountToDelete(null)}
          onConfirm={executeDelete}
        >
          <p className="wb-modal-text">
            Are you sure you want to permanently delete the account of <strong>{accountToDelete.name}</strong>?
          </p>
        </ConfirmModal>
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
                    {...clickableProps(() => setActiveRowId(account.user_id))}
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
                        aria-label={`Delete account: ${account.full_name}`}
                      >
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="trash-icon">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface)', borderRadius: '12px' }}>
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
