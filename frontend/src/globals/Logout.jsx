import React from 'react';
import ReactDOM from 'react-dom'; // FIX 1: Kailangan nating i-import ito para sa Portal
import { api } from '../api/client';

const Logout = ({ onCancel }) => {

    const handleLogout = async () => {
        try {
            await api.get('/api/logout');
            window.location.reload();
        } catch (e) {
            console.error("Logout failed", e.message);
        }
    }

    // FIX 2: Binalot natin ang buong return sa ReactDOM.createPortal
    return ReactDOM.createPortal( 
        <div className="wb-logout-page" onClick={onCancel}>
            <div className="wb-logout-card" onClick={(e) => e.stopPropagation()}>
                
                <div className="wb-logout-header">
                    <h2>Confirm Logout</h2>
                </div>

                <div className="wb-logout-content">
                    <div className="wb-logout-row">
                        <img 
                            src="/wblogo.png" 
                            alt="Wooden Bizzare Logo" 
                            className="wb-logout-img" 
                        />
                        <div className="wb-logout-text">
                            <p>Are you sure you want to logout?</p>
                        </div>
                    </div>

                    <div className="wb-logout-buttons">
                        <button onClick={onCancel}>Cancel</button>
                        <button onClick={handleLogout}>Yes, Logout</button>
                    </div>
                </div>
            </div>
        </div>,
        document.body // FIX 3: Dito natin sinasabi sa React na itapon ang modal sa labas ng Navbar!
    );
}
 
export default Logout;
