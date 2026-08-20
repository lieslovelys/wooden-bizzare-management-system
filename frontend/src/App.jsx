import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import RoleBasedRedirect from "./auth-components/RoleBasedRedirect";
import ProtectedRoute from "./auth-components/ProtectedRoute";
import Login from "./Login";
import { UserContext } from "./context/UserContext";
import ToastProvider from "./globals/ToastProvider";

import Admin from "./Admin";
import ProductionManager from "./ProductionManager";
import Inventory from "./Inventory";
import QualityChecker from "./QualityChecker";
import Worker from "./Worker";

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
      try {
        // Deliberately a direct fetch, not the shared api client (frontend/src/api/client.js):
        // a 401 here means "not logged in yet", which is a normal, expected outcome on every
        // fresh page load — not a stale-session error to redirect away from.
        const response = await fetch(import.meta.env.VITE_BACKEND_IP + '/api/session-user', {
          method: 'GET',
          credentials: 'include'
        });

        if(response.ok) {
          // P2 (envelope unification): /api/session-user now answers {success, data} like every
          // other route instead of the bare session-user object — see
          // ARCHITECTURE_REVIEW.md P2. This is the highest-blast-radius site in the app: getting
          // the `.data` unwrap wrong here means `userRole` is `undefined` and every
          // ProtectedRoute below fails, locking every role out.
          const { data } = await response.json();
          setUserID(data.user_id);
          setUsername(data.username);
          setFirstName(data.first_name);
          setMiddleName(data.middle_name);
          setLastName(data.last_name);
          setSuffix(data.suffix);
          setUserRole(data.user_role);
        }
      } catch(e) {
        console.error("Session fetch failed", e);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSession();
  }, [isLoggedIn]);

  if (isLoading) {
    return <div className="loading">Fetching data...</div>;
  }

  return (
    <ToastProvider>
      <UserContext.Provider value={{ userID, username, firstName, middleName, lastName, suffix, userRole }}>
        <Router>
          <div className="app-container">
            <Routes>
              <Route path='/' element={<RoleBasedRedirect role={userRole}/>}/>
              {/* /protoacc removed — TempSignup is now only reachable via the authenticated
                  Admin "Account Creation" screen (admin/CreateAccount.jsx). */}
              <Route path='/login' element={userRole ? <Navigate to={'/'}/> : <Login login={() => setIsLoggedIn(true)} />} />

              <Route element={<ProtectedRoute isAllowed={userRole === 'Admin'}/>}>
                <Route path="/admin/*" element={<Admin />} />
              </Route>

              <Route element={<ProtectedRoute isAllowed={userRole === 'Production Manager'}/>}>
                <Route path="/production-manager/*" element={<ProductionManager />} />
              </Route>

              <Route element={<ProtectedRoute isAllowed={userRole === 'Inventory Staff'}/>}>
                <Route path="/inventory/*" element={<Inventory />} />
              </Route>

              <Route element={<ProtectedRoute isAllowed={userRole === 'Quality Checker'}/>}>
                <Route path="/quality-check/*" element={<QualityChecker />} />
              </Route>

              <Route element={<ProtectedRoute isAllowed={userRole === 'Worker'}/>}>
                <Route path="/worker/*" element={<Worker />} />
              </Route>

              <Route path='*' element={<Navigate to='/' replace/>}/>
            </Routes>
          </div>
        </Router>
      </UserContext.Provider>
    </ToastProvider>
   );
}
 
export default App;
