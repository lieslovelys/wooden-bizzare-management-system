import { Link, useLocation } from 'react-router-dom';

const Navbar = ({ tabs, accountType, username }) => {
    const location = useLocation();

    const getInitial = () => {
        if (username) return username.charAt(0).toUpperCase();
        return 'U';
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
                <div className="avatar-circle">
                    {getInitial()}
                </div>
                <h2>{username}</h2>
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