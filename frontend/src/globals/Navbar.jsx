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

    // ARCHITECTURE_REVIEW.md item 44 — the redesigned profile row shows initials rather than the
    // role abbreviation, since the role itself is now printed as its own label underneath. Falls
    // back to the role abbreviation when a name isn't available (e.g. not yet loaded).
    const getInitials = (first, last) => {
        const initials = `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
        return initials || getRoleAbbreviation(userRole);
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
                <img src="/wblogo.png" alt="" className="mobile-topbar-logo" />
                <span className="mobile-topbar-title">The Wooden Bizarre</span>
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
                {/* LOGOUT MODAL KUNG TRUE ANG STATE */}
                {showLogoutModal && (
                    <Logout onCancel={() => setShowLogoutModal(false)} />
                )}

                <div className="navbar-header">
                    <img src="/wblogo.png" alt="The Wooden Bizarre logo" className="logo" />
                    <div className="title-group">
                        <h3>The Wooden Bizarre</h3>
                    </div>
                    {/* CLOSE BUTTON PARA SA MOBILE MENU — item 44: a real 44px button sitting in
                        the header row, not an absolutely-positioned glyph floating over it. */}
                    <button
                        className="navbar-close-btn"
                        aria-label="Close menu"
                        onClick={() => setIsMobileOpen(false)}
                    >
                        <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                    </button>
                </div>

                <div className="user-profile">
                    <div className="avatar-circle">
                        {getInitials(firstName, lastName)}
                    </div>

                    <div className="user-info">
                        <span className="user-role-label">{userRole}</span>
                        <p className="user-name">{firstName} {lastName}</p>
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

                    {/* 2. ITO YUNG PERMANENT LOGOUT BUTTON SA ILALIM — item 44 moved the old
                        inline style object into .logout-nav-item (globals.css) so the tablet-rail
                        reset and any future token change reach it the same as every other nav
                        item. */}
                    <button
                        type="button"
                        className="nav-item logout-nav-item"
                        onClick={() => setShowLogoutModal(true)}
                    >
                        <i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i>
                        <span className="nav-label">Logout</span>
                    </button>
                </nav>
            </div>

            {/* OVERLAY PARA SA MOBILE MENU */}
            {/* role="presentation": click-outside-to-close backdrop, not a semantic control —
                useDialog's Escape handling (wired on .wooden-navbar above) is the real keyboard
                equivalent, not a listener here. */}
            <div
                className={`mobile-overlay ${isMobileOpen ? 'active' : ''}`}
                role="presentation"
                onClick={() => setIsMobileOpen(false)}
            ></div>
        </>
    );
}

export default Navbar;
