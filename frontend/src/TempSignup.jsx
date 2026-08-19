import { useState } from "react";
import './css/TempSignup.css';
import { api } from './api/client';
import { useToast } from './context/ToastContext';

const TempSignup = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [middleName, setMiddleName] = useState('');
    const [lastName, setLastName] = useState('');
    const [suffix, setSuffix] = useState('None');
    const [userRole, setUserRole] = useState('Admin');

    const showToast = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();

        const body = { username, password, firstName, middleName, lastName, suffix, userRole };

        try {
            await api.post('/api/signup', body);
            showToast("Account successfully created!", "success");

            setUsername('');
            setPassword('');
            setFirstName('');
            setMiddleName('');
            setLastName('');
            setSuffix('None');
            setUserRole('Admin');
        } catch (error) {
            console.error("Error creating account:", error.message);
            showToast(error.message || "Failed to create account. Please try again.", "error");
        }
    }

    return ( 
        <div className="signup-wrapper">
            <div className="signup-container">
                <h2 className="form-title">CREATE ACCOUNT</h2>

                <form onSubmit={handleSubmit} className="signup-form">
                    
                    {/* ROW 1 */}
                    <div className="input-group">
                        <label htmlFor="first-name">First Name</label>
                        <input 
                            type="text" 
                            name="first-name" 
                            id="first-name" 
                            value={firstName} 
                            onChange={e => setFirstName(e.target.value.replace(/[0-9]/g, ''))} /* Bawal numbers */
                            required 
                        />
                    </div>

                    <div className="input-group">
                        <label htmlFor="middle-name">Middle Name</label>
                        <input 
                            type="text" 
                            name="middle-name" 
                            id="middle-name" 
                            value={middleName} 
                            onChange={e => setMiddleName(e.target.value.replace(/[0-9]/g, ''))} /* Bawal numbers */
                        />
                    </div>

                    <div className="input-group">
                        <label htmlFor="last-name">Last Name</label>
                        <input 
                            type="text" 
                            name="last-name" 
                            id="last-name" 
                            value={lastName} 
                            onChange={e => setLastName(e.target.value.replace(/[0-9]/g, ''))} /* Bawal numbers */
                            required 
                        />
                    </div>

                    <div className="input-group suffix-group">
                        <label htmlFor="suffix">Suffix</label>
                        <select name="suffix" id="suffix" value={suffix} onChange={e => setSuffix(e.target.value)}>
                            <option value="None">None</option>
                            <option value="Sr.">Sr.</option>
                            <option value="Jr.">Jr.</option>
                            <option value="II">II</option>
                            <option value="III">III</option>
                            <option value="IV">IV</option>
                            <option value="V">V</option>
                        </select>
                    </div>

                    {/* ROW 2 */}
                    <div className="input-group span-2">
                        <label htmlFor="username">Username</label>
                        <input type="text" name="username" id="username" value={username} onChange={e => setUsername(e.target.value)} required />
                    </div>

                    <div className="input-group span-2">
                        <label htmlFor="password">Password</label>
                        <input type="password" name="password" id="password" value={password} onChange={e => setPassword(e.target.value)} required />
                    </div>

                    {/* ROW 3 */}
                    <div className="input-group span-2">
                        <label htmlFor="user-role">Role</label>
                        <select className="bold-brown-text" name="user-role" id="user-role" value={userRole} onChange={e => setUserRole(e.target.value)}>
                            <option value="Admin">Admin</option>
                            <option value="Production Manager">Production Manager</option>
                            <option value="Inventory Staff">Inventory Staff</option>
                            <option value="Quality Checker">Quality Checker</option>
                            <option value="Worker">Worker</option>
                        </select>
                    </div>

                    {/* ROW 4 */}
                    <div className="submit-group">
                        <button type="submit">Create Account</button>
                    </div>
                </form>
            </div>
        </div>
     );
}
 
export default TempSignup;
