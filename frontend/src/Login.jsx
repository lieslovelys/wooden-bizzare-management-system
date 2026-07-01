import { useState } from "react";
import { useNavigate } from "react-router-dom";

const Login = ({ login }) => {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        const body = { username, password };
        
        // FIX: Tinanggal ang http://localhost:8080, ginawang relative path na lang
        const response = await fetch(import.meta.env.VITE_BACKEND_IP + '/login', {
            method: 'POST',
            headers: { 'Content-type': 'application/json' },
            body: JSON.stringify(body),
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            if (!data.err) {
                console.log(data);
                await login();
                window.location.reload();
            } else {
                console.log(data);
            }
        } else {
            return;
        }
    }

    return (
        <div className="login-layout">
            <div className="login-left">
                <div className="brand-header">
                    <img src="/wblogo.png" alt="Gavel" className="brand-logo" />
                    <div className="brand-title">
                        <h2>The Wooden Bizarre</h2>
                        <p>Management System</p>
                    </div>
                </div>

                <div className="hero-text">
                    <h1>Craft, tracked.<br />Business, <span className="gold-text">mastered.</span></h1>
                    <p className="hero-subtext">
                        From raw timber to finished furniture —<br />
                        manage every job order, worker, and peso<br />
                        in one place. Built for the workshop floor.
                    </p>
                </div>
            </div>

            <div className="login-right">
                <div className="login-container">
                    <div className="form-header">
                        <h2>Welcome Back!</h2>
                        <p>Sign in to your workspace</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label htmlFor="username">Username</label>
                            <input
                                type="text"
                                id="username"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                required
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="password">Password</label>
                            <div className="password-wrapper">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    id="password"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                />
                                <button 
                                    type="button" 
                                    className="eye-btn"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="submit-container">
                            <button type="submit" className="submit-btn">Sign In</button>
                        </div>
                    </form>

                    <div className="form-footer">
                        <p>Don't have an account? <a href="#">Contact your administration</a></p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;
