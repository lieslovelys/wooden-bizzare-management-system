import React, { useState, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserContext } from '../App'; 
import Logout from './Logout';

const Navbar = ({ tabs, accountType }) => {
    const location = useLocation();
    
    // State para sa Logout Pop-up
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    
    const { userRole, firstName, lastName } = useContext(UserContext);

    const getRoleAbbreviation = (role) => {
        switch (role) {
            case 'Admin': return 'A';
            case 'Production Manager': return 'PM';
            case 'Quality Checker': return 'QC';
            case 'Worker': return 'W';
            case 'Inventory Staff': return 'I';
            default: return 'U'; 
        }
    };

    return (
        <div className="wooden-navbar" style={{ position: 'relative' }}>
            
            {/* LOGOUT MODAL KUNG TRUE ANG STATE */}
            {showLogoutModal && (
                <Logout onCancel={() => setShowLogoutModal(false)} />
            )}

            <div className="navbar-header">
                <img src="/wblogo.png" alt="logo" className="logo" />
                <div className="title-group">
                    <h3>The Wooden Bizzare</h3>
                    <p>Management System</p>
                </div>
            </div>

            <div className="user-profile">
                <div className="avatar-circle">
                    {getRoleAbbreviation(userRole)}
                </div>
                
                <div className="user-info" style={{ marginLeft: '10px' }}>
                    <h2 style={{ margin: '0', fontSize: '1.2rem' }}>{userRole}</h2>
                    <p style={{ margin: '0', fontSize: '0.9rem', color: '#666' }}>
                        {firstName} {lastName}
                    </p>
                </div>
            </div>

            <nav className="nav-links">
                {/* 1. DITO MAG-LO-LOOP YUNG MGA NORMAL NA TABS MO */}
                {tabs.map(tab => {
                    const tabPath = `/${accountType.toLowerCase()}/${tab.url}`;
                    const isActive = 
                        location.pathname === tabPath || 
                        ((location.pathname === `/${accountType.toLowerCase()}` || location.pathname === `/${accountType.toLowerCase()}/`) && tab.url.toLowerCase() === 'dashboard');

                    return (
                        <Link key={tab.key} to={tabPath} style={{ textDecoration: 'none' }}>
                            <div className={`nav-item ${isActive ? 'active' : ''}`}>
                                <i className={tab.icon}></i>
                                <span>{tab.name}</span>
                            </div>
                        </Link>
                    );
                })}

                {/* 2. ITO YUNG PERMANENT LOGOUT BUTTON SA ILALIM */}
                <div 
                    className="nav-item logout-nav-item" 
                    onClick={() => setShowLogoutModal(true)} 
                    style={{ 
                        marginTop: 'auto', /* Laging itutulak nito yung button sa pinakailalim ng sidebar */
                        cursor: 'pointer', 
                        color: '#d9534f', /* Kulay pula */
                        fontWeight: 'bold',
                        borderTop: '1px solid rgba(0,0,0,0.1)',
                        paddingTop: '20px'
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '15px'}}>
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    <span>Logout</span>
                </div>
            </nav>
        </div>
    );
}

export default Navbar;