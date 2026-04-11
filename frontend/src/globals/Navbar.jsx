import { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
// Siguraduhing tama ang path pabalik sa App.jsx kung nasaan ang UserContext mo
import { UserContext } from '../App'; 

const Navbar = ({ tabs, accountType }) => {
    const location = useLocation();
    
    // DITO NATIN KUKUNIN YUNG DATA MULA SA APP.JSX!
    const { userRole, firstName, lastName } = useContext(UserContext);

    // Function natin kanina
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
        <div className="wooden-navbar">
            <div className="navbar-header">
                <img src="/public/wblogo.png" alt="logo" className="logo" />
                <div className="title-group">
                    <h3>The Wooden Bizzare</h3>
                    <p>Management System</p>
                </div>
            </div>

            <div className="user-profile">
                {/* Ipasa natin yung userRole mula sa context */}
                <div className="avatar-circle">
                    {getRoleAbbreviation(userRole)}
                </div>
                
                <div className="user-info" style={{ marginLeft: '10px' }}>
                    {/* Display yung userRole */}
                    <h2 style={{ margin: '0', fontSize: '1.2rem' }}>{userRole}</h2>
                    {/* Display yung Name mula sa context */}
                    <p style={{ margin: '0', fontSize: '0.9rem', color: '#666' }}>
                        {firstName} {lastName}
                    </p>
                </div>
            </div>

            <nav className="nav-links">
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
            </nav>
        </div>
    );
}

export default Navbar;