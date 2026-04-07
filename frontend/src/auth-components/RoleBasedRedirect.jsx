import { Navigate } from "react-router-dom";

const RoleBasedRedirect = ({role}) => {
   switch(role){
    case 'Admin' : return <Navigate to='/admin' replace />
    case 'Production Manager': return <Navigate to='/production-manager' replace />
    case 'Inventory Staff' : return  <Navigate to='/inventory' replace />
    case 'Quality Checker' : return <Navigate to='/quality-check' replace />
    case 'Worker' : return <Navigate to='/worker' replace />
    default: return <Navigate to='/login' replace />
   }
}
 
export default RoleBasedRedirect;