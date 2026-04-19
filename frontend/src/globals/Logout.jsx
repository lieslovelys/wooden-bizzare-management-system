import React from 'react';

// Nagdagdag tayo ng onCancel prop para pang-close ng pop-up
const Logout = ({ onCancel }) => {
    
    const handleLogout = async () => {
        try {
            // FIX: Tinanggal ang http://localhost:8080 at ginawang relative path
            const response = await fetch('/logout', {
                method: 'GET',
                credentials: 'include'
            });
            if (response.ok) {
                window.location.reload(); // Mag-re-refresh para bumalik sa login screen
            }
        } catch (e) {
            console.error("Logout failed", e);
        }
    }

    return ( 
        // Binalot natin sa overlay para maging pop-up
        <div className="wb-modal-overlay" onClick={onCancel}>
            
            {/* e.stopPropagation() para hindi mag-close kapag kinlik mismo yung puting card */}
            <div className="wb-logout-card" onClick={(e) => e.stopPropagation()} style={{ position: 'relative', backgroundColor: '#fff', padding: '25px', borderRadius: '12px', maxWidth: '400px' }}>
                
                <div className="wb-logout-header" style={{ marginBottom: '15px' }}>
                    <h2 style={{ margin: 0, color: '#4A3B12' }}>Confirm Logout</h2>
                </div>

                <div className="wb-logout-content">
                    <div className="wb-logout-row" style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
                        <img 
                            src="/wblogo.png" 
                            alt="Woodworking Plane" 
                            className="wb-logout-img" 
                            style={{ width: '60px', height: 'auto' }}
                        />
                        <div className="wb-logout-text">
                            <p style={{ margin: 0, color: '#1A1612', fontSize: '1.05rem' }}>Are you sure you want to logout?</p>
                        </div>
                    </div>

                    {/* Ginamit ko na rito yung mga button classes mo mula sa ibang modal para uniform */}
                    <div className="wb-logout-buttons" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button className="wb-btn-no" onClick={onCancel}>Cancel</button>
                        <button className="wb-btn-yes" onClick={handleLogout}>Yes, Logout</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
 
export default Logout;
