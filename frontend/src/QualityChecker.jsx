import { Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";
import { UserContext } from "./App";
import Navbar from "./globals/Navbar"; 
import Logout from "./globals/Logout"; 
import QCDashboard from "./quality_checker/QCDashboard";
import ProjectVerification from "./globals/ProjectVerification";
import QualityCheckerNotication from "./quality_checker/QualityCheckerNotification";


const QualityChecker = () => {
    const { username } = useContext(UserContext);

    const qcTabs = [
        { name: 'Dashboard', url: 'dashboard', key: 'db', icon: 'fas fa-th-large' },
        { name: 'Project Verification', url: 'project-verification', key: 'pv', icon: 'fas fa-check-circle' },
        { name: 'Notifications', url: 'notifications', key: 'nt', icon: 'fas fa-bell' },
        { name: 'Log Out', url: 'logout', key: 'lg', icon: 'fas fa-sign-out-alt' }
    ];

    return (
        <div className="role-layout">
            <Navbar tabs={qcTabs} accountType="quality-check" username={username || "Quality Checker"} />
            
            <div className="page-content">
                <Routes>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<QCDashboard />} />
                    <Route path="project-verification" element={<ProjectVerification />} />
                    <Route path="notifications" element={<QualityCheckerNotication />} />
                    <Route path="logout" element={<Logout />} />

                </Routes>
            </div>
        </div>
    );
}

export default QualityChecker;