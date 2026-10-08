import React, { useId } from 'react';
import ReactDOM from 'react-dom'; // FIX 1: Kailangan nating i-import ito para sa Portal
import { api } from '../api/client';
import { useDialog } from '../hooks/useDialog';

const Logout = ({ onCancel }) => {
    const titleId = useId();
    // Mounted conditionally by Navbar.jsx ({showLogoutModal && <Logout .../>}), same as
    // ConfirmModal — see that component's own useDialog call for why `open: true` is correct here.
    const dialogRef = useDialog({ open: true, onClose: onCancel });

    const handleLogout = async () => {
        try {
            // P2: GET /logout was a state-mutating GET — see ARCHITECTURE_REVIEW.md P2.
            await api.post('/api/logout');
            window.location.reload();
        } catch (e) {
            console.error("Logout failed", e.message);
        }
    }

    // FIX 2: Binalot natin ang buong return sa ReactDOM.createPortal
    return ReactDOM.createPortal(
        <div className="wb-logout-page" onClick={onCancel}>
            <div ref={dialogRef} className="wb-logout-card" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>

                <div className="wb-logout-header">
                    <h2 id={titleId}>Confirm Logout</h2>
                </div>

                <div className="wb-logout-content">
                    <div className="wb-logout-row">
                        <img 
                            src="/wblogo.png" 
                            alt="The Wooden Bizarre logo"
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
