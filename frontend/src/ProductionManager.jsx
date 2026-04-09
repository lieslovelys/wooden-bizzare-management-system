import { Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";
import { UserContext } from "./App";
import Navbar from "./globals/Navbar"; 
import Logout from "./globals/Logout"; 
import InventoryTable from "./globals/InventoryTable";

const Dashboard = () => <div><h1>Production Dashboard</h1></div>;
const JobOrder = () => <div><h1>Job Order Management</h1></div>;

const ProductionManager = () => {
    const { username } = useContext(UserContext);

    const pmTabs = [
        { name: 'Dashboard', url: 'dashboard', key: 'db', icon: 'fas fa-th-large' },
        { name: 'Job Order', url: 'job-order', key: 'jo', icon: 'fas fa-file-alt' },
        { name: 'Project Verification', url: 'verification', key: 'pv', icon: 'fas fa-certificate' },
        { name: 'Inventory', url: 'inventory', key: 'in', icon: 'fas fa-clipboard-check' },
        { name: 'Attendance', url: 'attendance', key: 'at', icon: 'fas fa-user-check' },
        { name: 'Project History', url: 'history', key: 'ph', icon: 'fas fa-history' },
        { name: 'Notifications', url: 'notifications', key: 'nt', icon: 'fas fa-bell' },
        { name: 'Log Out', url: 'logout', key: 'lg', icon: 'fas fa-sign-out-alt' }
    ];

    return (
        <div className="role-layout">
            <Navbar tabs={pmTabs} accountType="production-manager" username={username || "Production Manager"} />
            
            <div className="page-content">
                <Routes>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="job-order" element={<JobOrder />} />
                    <Route path="logout" element={<Logout />} />
                    <Route path="inventory/*" element={<InventoryTable />} />
                </Routes>
            </div>
        </div>
    );
}

export default ProductionManager;