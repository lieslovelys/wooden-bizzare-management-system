import { useState } from "react";
import { useNavigate } from "react-router-dom";

const Login = ({login}) => {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();

        const body = { username, password };

        const response = await fetch('http://localhost:8080/login',
            {
                method: 'POST',
                headers: {'Content-type' : 'application/json'},
                body: JSON.stringify(body),
                credentials: 'include'
            }
        )

        if(response.ok){
            const data = await response.json();
            if(!data.err){
                console.log(data);
                await login();
                window.location.reload();
            }
            else{
                console.log(data);
            }
        }
        else{
            return;
        }

    }
    return ( 
        <div className="login">
            <form onSubmit={handleSubmit}>
                <label htmlFor="username">Username</label><br />
                <input 
                type="text"
                id="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required /> <br /> <br />

                <label htmlFor="password">Password</label> <br />
                <input 
                type="password"
                id="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required /> <br /> <br />

                <button type="submit">Login</button>
            </form>
        </div>
     );
}
 
export default Login;