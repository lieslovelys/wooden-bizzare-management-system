import './css/worker.css'

import { Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";
import { UserContext } from "./context/UserContext";
import Navbar from "./globals/Navbar";
import NotificationProvider from "./globals/NotificationProvider";
import JobOrder from "./worker/WorkerJobOrder";
import WorkerNotification from "./worker/WorkerNotification";

const Worker = () => {
    const { username } = useContext(UserContext);

    // Eto lang ang tabs ni Worker base sa image
    const workerTabs = [
        { name: 'Job Order', url: 'job-order', key: 'jo', icon: 'fas fa-clipboard-list' },
        // FR-9 remainder: Worker's first notification screen — QA-outcome notifications
        // (Approved/Repair) target this one worker, see services/jobOrderService.js.
        { name: 'Notifications', url: 'notifications', key: 'nt', icon: 'fas fa-bell', showUnreadBadge: true },
    ];

    return (
        // FR-4/FR-9: unread-count polling for the navbar badge and NotificationList's live
        // refresh — see globals/NotificationProvider.jsx.
        <NotificationProvider>
            <div className="role-layout">
                <Navbar tabs={workerTabs} accountType="worker" username={username || "Worker"} />

                <div className="page-content">
                    <Routes>
                        <Route index element={<Navigate to="job-order" replace />} />
                        <Route path="job-order" element={<JobOrder />} />
                        <Route path="notifications" element={<WorkerNotification />} />

                        {/* Catch-all */}
                        <Route path="*" element={<Navigate to="job-order" replace />} />
                    </Routes>
                </div>
            </div>
        </NotificationProvider>
    );
}

export default Worker;
