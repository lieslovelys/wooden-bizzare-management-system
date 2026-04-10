import React, { useState, useEffect } from 'react';
import '../css/admin.css'; 

const AccountList = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeRowId, setActiveRowId] = useState(null); 

  // Inilabas natin ang fetch function para matawag ulit mamaya
  const fetchAccounts = async () => {
    try {
      const response = await fetch('http://localhost:8080/users');
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

  // DELETE FUNCTION
  const handleDelete = async (id, name, e) => {
    e.stopPropagation(); // Iwas trigger sa row click color
    
    // Safety check para hindi ma-delete nang aksidente
    const confirmDelete = window.confirm(`Are you sure you want to delete ${name}' account?`);
    
    if (confirmDelete) {
      try {
        const response = await fetch(`http://localhost:8080/users/${id}`, {
          method: 'DELETE',
        });
        const result = await response.json();

        if (result.success) {
          alert('Deleted successfully!');
          fetchAccounts(); // REFRESH: Tatawagin ulit ang listahan para mawala yung deleted row
        } else {
          alert('Failed to delete user.');
        }
      } catch (error) {
        console.error('Delete error:', error);
        alert('An error occurred while deleting.');
      }
    }
  };

  return (
    <div className="account-list">
      <div className="account-list-container">
        {loading ? (
          <p style={{ textAlign: 'center', padding: '20px' }}>Loading accounts...</p>
        ) : (
          <table className="account-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Account Role</th>
                <th>Username</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length > 0 ? (
                accounts.map((account) => (
                  <tr 
                    key={account.user_id}
                    onClick={() => setActiveRowId(account.user_id)}
                    className={activeRowId === account.user_id ? 'active-row' : ''}
                  >
                    <td>{account.formatted_id}</td>
                    <td>{account.full_name}</td>
                    <td className="role-cell">{account.user_role}</td>
                    <td>{account.username}</td>
                    <td>
                      <button 
                        className="delete-btn" 
                        onClick={(e) => handleDelete(account.user_id, account.full_name, e)} 
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="trash-icon">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>No accounts found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AccountList;