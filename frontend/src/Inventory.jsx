import { Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";
import { UserContext } from "./context/UserContext";
import Navbar from "./globals/Navbar"; 
import InventoryTable from "./globals/InventoryTable";


const Inventory = () => {
    const { username } = useContext(UserContext);

    const inventoryTabs = [
        { name: 'Inventory Table', url: 'inventory-table', key: 'it', icon: 'fas fa-clipboard-check' },
    ];

    return (
        <div className="role-layout">
            {/* "inventory" ang accountType para sa URL pattern na /inventory/url */}
            <Navbar tabs={inventoryTabs} accountType="inventory" username={username || "Inventory"} />
            
            <div className="page-content">
                <Routes>
                    {/* Index route: automatic na mapupunta sa Inventory Table */}
                    <Route index element={<Navigate to="inventory-table" replace />} />
                    <Route path="inventory-table" element={<InventoryTable />} />
                    
                    {/* Catch-all sa loob ng inventory module */}
                    <Route path="*" element={<Navigate to="inventory-table" replace />} />
                </Routes>
            </div>
        </div>
    );
}

export default Inventory;