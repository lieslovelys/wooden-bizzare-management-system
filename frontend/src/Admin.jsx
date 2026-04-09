import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";
import { UserContext } from "./App";
import Navbar from "./globals/Navbar"; 
import Logout from "./globals/Logout"; 
import AccountPage from "./admin/pages/AccountPage";
import AdminDashboard from "./admin/A_Dashboard";
import WorkerList from "./admin/WorkerList";
import ProjectVerification from "./globals/ProjectVerification";
import Profit from "./admin/Profit";
import WorkerProductivity from "./admin/WorkerProductivity";
import ProjectHistory from "./admin/ProjectHistory";
import Notification from "./admin/Notification";
import JobOrder from "./globals/JobOrder";
import Attendance from "./globals/Attendance";
import InventoryTable from "./globals/InventoryTable";
import CreateProject from "./admin/CreateProject";

const Admin = () => {
    const { username } = useContext(UserContext);
    const adminTabs = [
        { name: 'Dashboard', url: 'dashboard', key: 'db', icon: 'fas fa-th-large' },
        { name: 'Account Creation', url: 'account-creation', key: 'ac', icon: 'fas fa-user-circle' },
        { name: 'Create Project', url: 'create-project', key: 'cp', icon: 'fas fa-edit' },
        { name: 'Job Order', url: 'job-order', key: 'jo', icon: 'fas fa-clipboard' },
        { name: 'Worker List', url: 'worker-list', key: 'wl', icon: 'fas fa-hard-hat' },
        { name: 'Project Verification', url: 'project-verification', key: 'pv', icon: 'fas fa-check-circle' },
        { name: 'Attendance', url: 'attendance', key: 'at', icon: 'fas fa-address-card' },
        { name: 'Inventory Table', url: 'inventory', key: 'in', icon: 'fas fa-clipboard-check' },
        { name: 'Profit', url: 'profit', key: 'pr', icon: 'fas fa-peso-sign' },
        { name: 'Worker Productivity', url: 'productivity', key: 'wp', icon: 'fas fa-chart-line' },
        { name: 'Project History', url: 'project-history', key: 'ph', icon: 'fas fa-clock-rotate-left' },
        { name: 'Notification', url: 'notification', key: 'nt', icon: 'fas fa-bell' },
        { name: 'Log Out', url: 'logout', key: 'lg', icon: 'fas fa-sign-out-alt' }
    ];

    return (
        <div className="role-layout">
            <Navbar tabs={adminTabs} accountType="Admin" username={username || "Admin"} />
            
            <div className="page-content">
                <Routes>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<AdminDashboard />} />
                    <Route path="account-creation" element={<AccountPage />} />
                    <Route path="job-order" element={<JobOrder />} />
                    <Route path="worker-list" element={<WorkerList />} />
                    <Route path="project-verification" element={<ProjectVerification />} />
                    <Route path="attendance" element={<Attendance />} />
                    <Route path="profit" element={<Profit />} />
                    <Route path="productivity" element={<WorkerProductivity />} />
                    <Route path="project-history" element={<ProjectHistory />} />
                    <Route path="notification" element={<Notification />} />
                    <Route path="create-project" element={<CreateProject />} />
                    <Route path="inventory" element={<InventoryTable />} />
                    <Route path="logout" element={<Logout />} />
                </Routes>
            </div>
        </div>
    );
}

export default Admin;