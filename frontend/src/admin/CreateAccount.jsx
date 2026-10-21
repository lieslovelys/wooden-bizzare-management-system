import React, { useState } from 'react';
import AccountForm from './AccountForm';
import AccountList from './AccountList';
import '../css/admin.css'; // Ibinalik ko yung import ng CSS para basahin niya yung design

const AccountManagement = () => {
  const [activeTab, setActiveTab] = useState('creation');

  return (
    /* Ibinalik ko yung create-account wrapper para gumana yung ginawa nating CSS */
    <div className="create-account">
      
      <div className="account-management-wrapper">
        
        {/* Tabs Container */}
        <div className="tabs-header">
          <button
            className={`tab-button ${activeTab === 'creation' ? 'active' : ''}`}
            onClick={() => setActiveTab('creation')}
          >
            Account Creation
          </button>
          <button
            className={`tab-button ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            Account List
          </button>
        </div>

        {/* Thick horizontal divider (The line under the tabs) */}
        <div className="tab-divider"></div>

        {/* Tab Content Rendering */}
        <div className="tab-content-container">
          {activeTab === 'creation' ? (
            <AccountForm />
          ) : (
            <AccountList />
          )}
        </div>
        
      </div>

    </div>
  );
};

export default AccountManagement;
