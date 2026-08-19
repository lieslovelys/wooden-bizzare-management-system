import React, { useState, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserContext } from '../context/UserContext';
import Logout from './Logout';

const Navbar = ({ tabs, accountType }) => {
    const location = useLocation();
    
    // State para sa Logout Pop-up
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    
    // State para sa Mobile Menu
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    
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
        <>
            {/* MOBILE HAMBURGER BUTTON (Lilitaw lang kapag maliit ang screen) */}
            <button 
                className="mobile-menu-btn" 
                onClick={() => setIsMobileOpen(true)}
            >
                <i className="fa-solid fa-bars"></i>
            </button>

            {/* NAVBAR CONTAINER */}
            <div className={`wooden-navbar ${isMobileOpen ? 'mobile-active' : ''}`} style={{ position: 'relative' }}>
                
                {/* CLOSE BUTTON PARA SA MOBILE MENU */}
                {/* CLOSE BUTTON PARA SA MOBILE MENU */}
                <button 
                className="close-mobile-btn" 
                onClick={() => setIsMobileOpen(false)}
                >
                &times;
                </button>

                {/* LOGOUT MODAL KUNG TRUE ANG STATE */}
                {showLogoutModal && (
                    <Logout onCancel={() => setShowLogoutModal(false)} />
                )}

                <div className="navbar-header">
                    <img src="/wblogo.png" alt="logo" className="logo" />
                    <div className="title-group">
                        <h3>The Wooden Bizarre</h3>
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
                            <Link key={tab.key} to={tabPath} style={{ textDecoration: 'none' }} onClick={() => setIsMobileOpen(false)}>
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
                            marginTop: 'auto', 
                            cursor: 'pointer', 
                            color: '#d9534f', 
                            fontWeight: 'bold',
                            borderTop: '1px solid rgba(255, 255, 255, 0.1)', // Ginawang lighter ang border para mas kita sa dark theme
                            paddingTop: '20px'
                        }}
                    >
                        <i className="fa-solid fa-arrow-right-from-bracket" style={{marginRight: '15px'}}></i>
                        <span>Logout</span>
                    </div>
                </nav>
            </div>

            {/* OVERLAY PARA SA MOBILE MENU */}
            <div 
                className={`mobile-overlay ${isMobileOpen ? 'active' : ''}`} 
                onClick={() => setIsMobileOpen(false)}
            ></div>
        </>
    );
}

export default Navbar;
