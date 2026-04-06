import './css/admin.css'
import CreateProject from './admin/CreateProject';
import Logout from './globals/Logout';


const Admin = () => {
    return ( 
        <div className="admin">
            <h1>ADmin</h1>
            <Logout />
        </div>
     );
}
 
export default Admin;