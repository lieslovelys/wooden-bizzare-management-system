import React, { useState, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserContext } from '../context/UserContext';
import { useNotifications } from '../context/NotificationContext';
import Logout from './Logout';
import { useDialog } from '../hooks/useDialog';

const Navbar = ({ tabs, accountType }) => {
    const location = useLocation();
    
    // State para sa Logout Pop-up
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    
    // State para sa Mobile Menu
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    // This same element is the permanent desktop sidebar outside mobile widths — the mobile
    // hamburger that sets isMobileOpen is itself only ever visible/clickable on mobile (mobile-
    // topbar's own media query), so useDialog's Escape/focus-trap/focus-return only ever actually
    // engage while this is genuinely acting as an off-canvas drawer, not the permanent sidebar.
    const navDialogRef = useDialog({ open: isMobileOpen, onClose: () => setIsMobileOpen(false) });

    const { userRole, firstName, lastName } = useContext(UserContext);
    // FR-4/FR-9: a tab opts into the badge with `showUnreadBadge: true` — without a
    // NotificationProvider mounted above (Inventory Staff is the only role left with no
    // notification screen), useNotifications() returns its default of 0, so the badge just never
    // renders.
    const { unreadCount } = useNotifications();

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
            {/* MOBILE TOPBAR (Lilitaw lang kapag maliit ang screen) — DESIGN.md §7#5: the
                hamburger used to float with nothing behind it, so scrolled content ran underneath
                it. It now lives inside a bar the page can pad below instead of guessing at. */}
            <header className="mobile-topbar">
                <button
                    className="mobile-menu-btn"
                    aria-label="Open menu"
                    onClick={() => setIsMobileOpen(true)}
                >
                    <i className="fa-solid fa-bars" aria-hidden="true"></i>
                </button>
            </header>

            {/* NAVBAR CONTAINER */}
            <div
                ref={navDialogRef}
                className={`wooden-navbar ${isMobileOpen ? 'mobile-active' : ''}`}
                style={{ position: 'relative' }}
                role={isMobileOpen ? 'dialog' : undefined}
                aria-modal={isMobileOpen ? 'true' : undefined}
                aria-label={isMobileOpen ? 'Navigation menu' : undefined}
            >
                
                {/* CLOSE BUTTON PARA SA MOBILE MENU */}
                {/* CLOSE BUTTON PARA SA MOBILE MENU */}
                <button
                className="close-mobile-btn"
                aria-label="Close menu"
                onClick={() => setIsMobileOpen(false)}
                >
                &times;
                </button>

                {/* LOGOUT MODAL KUNG TRUE ANG STATE */}
                {showLogoutModal && (
                    <Logout onCancel={() => setShowLogoutModal(false)} />
                )}

                <div className="navbar-header">
                    <img src="/wblogo.png" alt="The Wooden Bizarre logo" className="logo" />
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
                        <p style={{ margin: '0', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
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
                            <Link key={tab.key} to={tabPath} style={{ textDecoration: 'none' }} onClick={() => setIsMobileOpen(false)} aria-current={isActive ? 'page' : undefined}>
                                <div className={`nav-item ${isActive ? 'active' : ''}`}>
                                    <span className="nav-icon-wrap">
                                        <i className={tab.icon} aria-hidden="true"></i>
                                        {tab.showUnreadBadge && unreadCount > 0 && (
                                            <span className="nav-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                                        )}
                                    </span>
                                    {/* Own class (not a bare <span>) so css/globals.css's tablet
                                        rail CSS (DESIGN.md §7#9) can target just the label —
                                        .nav-icon-wrap above is also a <span>. */}
                                    <span className="nav-label">{tab.name}</span>
                                </div>
                            </Link>
                        );
                    })}

                    {/* 2. ITO YUNG PERMANENT LOGOUT BUTTON SA ILALIM */}
                    <button
                        type="button"
                        className="nav-item logout-nav-item"
                        onClick={() => setShowLogoutModal(true)}
                        style={{
                            marginTop: 'auto',
                            cursor: 'pointer',
                            color: 'var(--color-danger)',
                            fontWeight: 'bold',
                            borderTop: '1px solid rgba(255, 255, 255, 0.1)', // Ginawang lighter ang border para mas kita sa dark theme
                            paddingTop: '20px',
                            // Button-reset: .nav-item's class CSS covers layout/color/padding, but
                            // not background/border, which a real <button> gets from the UA
                            // stylesheet — these undo that without touching the borderTop above
                            // (the `border` shorthand would have reset it too).
                            background: 'none',
                            borderLeft: 'none',
                            borderRight: 'none',
                            borderBottom: 'none',
                            width: '100%',
                            textAlign: 'left',
                            font: 'inherit',
                        }}
                    >
                        {/* marginRight dropped: .nav-item already has `gap: 15px` between
                            children, and an inline style would win over any CSS override the
                            tablet rail (DESIGN.md §7#9) needs to zero it out for the stacked
                            icon-above-label layout. */}
                        <i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i>
                        <span className="nav-label">Logout</span>
                    </button>
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
