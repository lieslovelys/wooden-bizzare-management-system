import { Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";
import { UserContext } from "./App";
import Navbar from "./globals/Navbar"; 
import Logout from "./globals/Logout"; 

const InventoryTable = () => <div><h1>Inventory Table & Stock Management</h1></div>;

const Inventory = () => {
    const { username } = useContext(UserContext);
    const inventoryTabs = [
        { name: 'Inventory Table', url: 'inventory-table', key: 'it', icon: 'fas fa-share-nodes' },
        { name: 'Log Out', url: 'logout', key: 'lg', icon: 'fas fa-sign-out-alt' }
    ];

    return (
        <div className="role-layout">
            <Navbar tabs={inventoryTabs} accountType="inventory" username={username || "Inventory"} />
            
            <div className="page-content">
                <Routes>
                    <Route index element={<Navigate to="inventory-table" replace />} />
                    <Route path="inventory-table" element={<InventoryTable />} />
                    
                    <Route path="logout" element={<Logout />} />
                    
   
                </Routes>
            </div>
        </div>
    );
}

export default Inventory;