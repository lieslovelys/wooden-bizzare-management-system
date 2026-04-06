import { useState, useEffect, createContext } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import RoleBasedRedirect from "./auth-components/RoleBasedRedirect";
import ProtectedRoute from "./auth-components/ProtectedRoute";
import TempSignup from "./TempSignup";
import Login from "./Login";

import Admin from "./Admin";
import ProductionManager from "./ProductionManager";
import Inventory from "./Inventory";
import QualityChecker from "./QualityChecker";
import Worker from "./Worker";


const UserContext = createContext();

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [userID, setUserID] = useState('');
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [suffix, setSuffix] = useState('');
  const [userRole, setUserRole] = useState(null);


  useEffect(() => {
    const fetchSession = async () => {
      try{
        const response = await fetch('http://localhost:8080/session-user',
          {
            method: 'GET',
            credentials: 'include'
          }
        )

        if(response.ok){
          const data = await response.json();
          console.log(data);
          setUserID(data.user_id);
          setUsername(data.username);
          setFirstName(data.first_name);
          setMiddleName(data.middle_name);
          setLastName(data.last_name);
          setSuffix(data.suffix);
          setUserRole(data.user_role);
        }
        
      }
      catch(e){
        console.error("Session fetch failed", err);
      }
      finally{
        setIsLoading(false);
      }
      
    }

    fetchSession();
  }, [isLoggedIn]);

  

  if (isLoading) {
    return <div className="loading">Fetching data...</div>;
  }

  console.log(`Galing sa app: ${userRole}`);
  return ( 
    <UserContext.Provider value={{ userID, username, firstName, middleName, lastName, suffix, userRole }}>
      <Router>
        <div>
          <Routes>
            <Route path='/' element={<RoleBasedRedirect role={userRole}/>}/>
            <Route path='/signup' element={<TempSignup />} />
            <Route path='/login' element={userRole? <Navigate to={'/'}/> : <Login login={() => setIsLoading(false)} />} />
              

            <Route element={<ProtectedRoute isAllowed={userRole === 'Admin'}/>}>
              <Route path="/admin" element={<Admin />} />
            </Route>

            <Route element={<ProtectedRoute isAllowed={userRole === 'Production Manager'}/>}>
              <Route path="/production" element={<ProductionManager />} />
            </Route>

            <Route element={<ProtectedRoute isAllowed={userRole === 'Inventory Staff'}/>}>
              <Route path="/inventory" element={<Inventory />} />
            </Route>

            <Route element={<ProtectedRoute isAllowed={userRole === 'Quality Checker'}/>}>
              <Route path="/quality-check" element={<QualityChecker />} />
            </Route>

            <Route element={<ProtectedRoute isAllowed={userRole === 'Worker'}/>}>
              <Route path="/worker" element={<Worker />} />
            </Route>


            <Route path='*' element={<Navigate to='/' replace/>}/>
          </Routes>
        </div>
      </Router>
    </UserContext.Provider>
   );
}
 
export default App;