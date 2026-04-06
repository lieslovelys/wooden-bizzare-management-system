import { useNavigate } from "react-router-dom";

const Logout = () => {
    const Navigate = useNavigate();
    const handleLogout = async () => {
        try{
            const response = await fetch('http://localhost:8080/logout',
                {
                    method: 'GET',
                    credentials: 'include'
                }
            )

            if(response.ok){
                const data = await response.json();
                console.log(data);
                
                window.location.reload();   
            }
        }
        catch(e){
            console.log(e);
        }
    }

    return ( 
        <div className="logout">
            <h2>Are you sure you want to log out?</h2>
            <button onClick={handleLogout}>Yes, Logout</button>
            <button>Cancel</button>
        </div>
     );
}
 
export default Logout;