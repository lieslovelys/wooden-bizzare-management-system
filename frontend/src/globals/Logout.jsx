import { useNavigate } from "react-router-dom";

const Logout = () => {
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            const response = await fetch('http://localhost:8080/logout', {
                method: 'GET',
                credentials: 'include'
            });
            if (response.ok) {
                window.location.reload();
            }
        } catch (e) {
            console.error("Logout failed", e);
        }
    }

    return ( 
        <div className="wb-logout-page">
            <div className="wb-logout-card">
                <div className="wb-logout-header">
                    <h2>Confirm Logout</h2>
                </div>

                <div className="wb-logout-content">
                    <div className="wb-logout-row">
                        <img 
                            src="/public/wblogo.png" 
                            alt="Woodworking Plane" 
                            className="wb-logout-img" 
                        />
                        <div className="wb-logout-text">
                            <p>Are you sure you want to logout?</p>
                        </div>
                    </div>

                    <div className="wb-logout-buttons">
                        <button className="wb-btn-confirm" onClick={handleLogout}>Yes, Logout</button>
                        <button className="wb-btn-cancel" onClick={() => navigate(-1)}>Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
 
export default Logout;