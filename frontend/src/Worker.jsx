import './css/worker.css'

import { Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";
import { UserContext } from "./App";
import Navbar from "./globals/Navbar"; 
import Logout from "./globals/Logout"; 

// Dummy component para sa Worker's main page
const JobOrder = () => <div><h1>Assigned Job Orders</h1></div>;

const Worker = () => {
    const { username } = useContext(UserContext);

    // Eto lang ang tabs ni Worker base sa image
    const workerTabs = [
        { name: 'Job Order', url: 'job-order', key: 'jo', icon: 'fas fa-clipboard-list' },
        { name: 'Log Out', url: 'logout', key: 'lg', icon: 'fas fa-sign-out-alt' }
    ];

    return (
        <div className="role-layout">
            <Navbar tabs={workerTabs} accountType="worker" username={username || "Worker"} />
            
            <div className="page-content">
                <Routes>
                    <Route index element={<Navigate to="job-order" replace />} />
                    <Route path="job-order" element={<JobOrder />} />
                    
                    <Route path="logout" element={<Logout />} />
                    
                    {/* Catch-all */}
                    <Route path="*" element={<Navigate to="job-order" replace />} />
                </Routes>
            </div>
        </div>
    );
}

export default Worker;