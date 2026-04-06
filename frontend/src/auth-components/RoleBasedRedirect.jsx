import { Navigate } from "react-router-dom";

const RoleBasedRedirect = ({role}) => {
   switch(role){
    case 'Admin' : return <Navigate to='/admin' replace />
    case 'Production Manager': return <Navigate to='/production-manager' replace />
    case 'Inventory Staff' : return  <Navigate to='/inventory-staff' replace />
    case 'Quality Check Staff' : return <Navigate to='/quality-check-staff' replace />
    case 'Worker' : return <Navigate to='/worker' replace />
    default: return <Navigate to='/login' replace />
   }
}
 
export default RoleBasedRedirect;