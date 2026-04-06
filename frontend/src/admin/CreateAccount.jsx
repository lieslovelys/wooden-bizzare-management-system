import { useState } from "react";

const CreateAccount = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [middleName, setMiddleName] = useState('');
    const [lastName, setLastName] = useState('');
    const [suffix, setSuffix] = useState('None');
    const [userRole, setUserRole] = useState('Admin');

    const handleSubmit = (e) => {
        e.preventDefault();

        const body = { username, password, firstName, middleName, lastName, suffix, userRole };
    }
    
    return ( 
        <div className="create-account">
            
            <form onSubmit={handleSubmit}>
                <label htmlFor="username">Username</label> <br />
                <input 
                type="text"
                name="username"
                id="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required /> <br /> <br />
                
                <label htmlFor="password">Password</label> <br />
                <input 
                type="password"
                name="password"
                id="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required /> <br /> <br />

                <label htmlFor="first-name">First Name</label> <br /> 
                <input 
                type="text"
                name="first-name"
                id="first-name"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                required /> <br /> <br />

                <label htmlFor="middle_name">Middle Name</label> <br />
                <input 
                type="text"
                name="middle-name"
                id="middle-name"
                value={middleName}
                onChange={e => setMiddleName(e.target.value)}
                required /> <br /> <br />

                <label htmlFor="last-name">Last Name</label> <br />
                <input 
                type="text"
                name="last-name"
                id="last-name"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                required /> <br /> <br />

                <label htmlFor="suffix">Suffix</label> <br />
                <select name="suffix" id="suffix" value={suffix} onChange={e => setSuffix(e.target.value)}>
                    <option value="None">None</option>
                    <option value="Sr.">Sr.</option>
                    <option value="Jr.">Jr.</option>
                    <option value="II">II</option>
                    <option value="III">III</option>
                    <option value="IV">IV</option>
                    <option value="V">V</option>
                </select> <br /> <br />

                <label htmlFor="user-role">User Role</label> <br />
                <select name="user-role" id="user-role" value={userRole} onChange={e => setUserRole(e.target.value)}>
                    <option value="Admin">Admin</option>
                    <option value="Production Manager">Production Manager</option>
                    <option value="Inventory Staff">Inventory Staff</option>
                    <option value="Quality Checker">Quality Checker</option>
                    <option value="Worker">Worker</option>
                </select> <br /> <br />

                <button type="submit">Sign Up</button>
            </form>
        </div>
     );
}
 
export default CreateAccount;