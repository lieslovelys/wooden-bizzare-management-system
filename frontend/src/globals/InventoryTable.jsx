import React, { useState, useEffect } from 'react';
import '../css/inventory.css'; 

const InventoryTable = () => {
    // FIX 1: Pinalitan ang initialData ng empty array [] para hindi mag-error kapag walang laman
    const [items, setItems] = useState(() => {
        const savedData = localStorage.getItem('my_inventory_data');
        return savedData ? JSON.parse(savedData) : [];
    });

    const [expandedRow, setExpandedRow] = useState(null);
    const [activeFilter, setActiveFilter] = useState('All');

    // States for Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        category: 'Raw Material',
        unit: '',
        variants: [{ id: Date.now(), name: '' }]
    });

    useEffect(() => {
        localStorage.setItem('my_inventory_data', JSON.stringify(items));
    }, [items]);

    const toggleRow = (id) => {
        setExpandedRow(expandedRow === id ? null : id);
    };

    const handleDelete = (e, id) => {
        e.stopPropagation();
        if (window.confirm("Are you sure you want to delete this item?")) {
            setItems(items.filter(item => item.id !== id));
        }
    };

    const handleAdjustStock = (e, itemId, variantId, amount) => {
        e.stopPropagation(); 

        setItems(prevItems => prevItems.map(item => {
            if (item.id === itemId) {
                const updatedVariants = item.variants.map(v => {
                    if (v.id === variantId) {
                        const newStock = Math.max(0, (v.current || 0) + amount);
                        return { ...v, current: newStock };
                    }
                    return v;
                });

                const newTotalStock = updatedVariants.reduce((sum, v) => sum + (v.current || 0), 0);
                const isLow = updatedVariants.some(v => v.current <= v.min);
                const newStatus = isLow ? "Low" : "Good";

                return { ...item, variants: updatedVariants, total_stock: newTotalStock, status: newStatus };
            }
            return item;
        }));
    };

    // --- MODAL FUNCTIONS ---
    const openAddModal = () => {
        setModalMode('add');
        setFormData({ name: '', category: 'Raw Material', unit: '', variants: [{ id: Date.now(), name: '' }] });
        setIsModalOpen(true);
    };

    const openEditModal = (e, item) => {
        e.stopPropagation();
        setModalMode('edit');
        setEditingItem(item);
        setFormData({
            name: item.name,
            category: item.category,
            unit: item.unit,
            variants: item.variants ? item.variants.map(v => ({ id: v.id, name: v.name })) : []
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingItem(null);
    };

    const handleVariantChange = (id, newName) => {
        setFormData(prev => ({
            ...prev,
            variants: prev.variants.map(v => v.id === id ? { ...v, name: newName } : v)
        }));
    };

    const addVariantField = () => {
        setFormData(prev => ({
            ...prev,
            variants: [...prev.variants, { id: Date.now(), name: '' }]
        }));
    };

    const removeVariantField = (id) => {
        setFormData(prev => ({
            ...prev,
            variants: prev.variants.filter(v => v.id !== id)
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (modalMode === 'add') {
            const newItem = {
                id: Date.now(),
                ...formData,
                total_stock: 0,
                status: "Low",
                variants: formData.variants.map(v => ({ ...v, current: 0, min: 5 })) 
            };
            setItems([...items, newItem]);
        } else {
            setItems(items.map(item => {
                if (item.id === editingItem.id) {
                    const updatedVariants = formData.variants.map(v => {
                        const originalVariant = item.variants.find(orig => orig.id === v.id);
                        return {
                            ...v,
                            current: originalVariant && originalVariant.current !== undefined ? originalVariant.current : 0,
                            min: originalVariant && originalVariant.min !== undefined ? originalVariant.min : 5 
                        };
                    });

                    const newTotalStock = updatedVariants.reduce((sum, v) => sum + (v.current || 0), 0);
                    const isLow = updatedVariants.some(v => v.current <= v.min);
                    const newStatus = isLow ? "Low" : "Good";

                    return { 
                        ...item, 
                        name: formData.name, 
                        category: formData.category, 
                        unit: formData.unit, 
                        variants: updatedVariants,
                        total_stock: newTotalStock,
                        status: newStatus
                    };
                }
                return item;
            }));
        }
        closeModal();
    };

    // FIX 2: Nilagyan ng (items || []) para kahit ma-corrupt ang data, hindi magka-crash
    const filteredItems = (items || []).filter(item => {
        if (activeFilter === 'All') return true;
        if (activeFilter === 'Raw materials') return item.category === 'Raw Material';
        if (activeFilter === 'Tools') return item.category === 'Tool';
        if (activeFilter === 'Consumables') return item.category === 'Consumable';
        return true;
    });

    return (
        <div className="inventory-container">
            <div className="inventory-header">
                <div className="filters">
                    {['All', 'Raw materials', 'Tools', 'Consumables'].map(filterName => (
                        <button 
                            key={filterName}
                            className={`filter-btn ${activeFilter === filterName ? 'active' : ''}`}
                            onClick={() => setActiveFilter(filterName)}
                        >
                            {filterName}
                        </button>
                    ))}
                </div>
                <button className="add-btn" onClick={openAddModal}>+ Add Item</button>
            </div>

            <div className="table-wrapper">
                <table className="inventory-table">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Category</th>
                            <th>Variants</th>
                            <th>Total Stock</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredItems.length === 0 ? (
                            <tr>
                                <td colSpan="6" style={{ padding: '30px', color: '#888', textAlign: 'center' }}>
                                    No items found in this category. Click "+ Add Item" to start.
                                </td>
                            </tr>
                        ) : (
                            filteredItems.map((item) => {
                                const isExpanded = expandedRow === item.id;
                                return (
                                    <React.Fragment key={item.id}>
                                        <tr className={`main-row ${isExpanded ? 'active' : ''}`} onClick={() => toggleRow(item.id)}>
                                            <td className="item-name">{item.name}</td>
                                            <td><span className="category-pill">{item.category}</span></td>
                                            <td className="variants-cell">
                                                {item.variants?.map(v => (
                                                    <span key={v.id} className="variant-pill">{v.name}</span>
                                                ))}
                                            </td>
                                            <td className="stock-cell"><strong>{item.total_stock}</strong> {item.unit}</td>
                                            <td><span className={`status-pill ${item.status?.toLowerCase()}`}>{item.status}</span></td>
                                            
                                            <td className="actions-cell">
                                                <button className="action-btn edit-btn" onClick={(e) => openEditModal(e, item)} title="Edit">
                                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#bfa15f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                    </svg>
                                                </button>
                                                <button className="action-btn delete-btn" onClick={(e) => handleDelete(e, item.id)} title="Delete">
                                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff4d4d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                        <line x1="10" y1="11" x2="10" y2="17"></line>
                                                        <line x1="14" y1="11" x2="14" y2="17"></line>
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>

                                        {/* EXPANDED ROW */}
                                        {isExpanded && item.variants && (
                                            <tr className="expanded-row">
                                                <td colSpan="6">
                                                    <div className="variants-details">
                                                        {item.variants.map(variant => {
                                                            const isLow = variant.current <= variant.min;
                                                            const barWidth = Math.min(((variant.current || 0) / (variant.min * 5)) * 100, 100);

                                                            return (
                                                                <div className="variant-line" key={variant.id}>
                                                                    <span className="var-name">{variant.name}</span>
                                                                    
                                                                    <div className="progress-bar-container">
                                                                        <div 
                                                                            className={`progress-bar ${isLow ? 'low' : 'good'}`} 
                                                                            style={{ width: `${barWidth}%` }}
                                                                        ></div>
                                                                    </div>
                                                                    
                                                                    <span className="var-stock">
                                                                        <strong style={{ color: isLow ? '#ff0000' : '#4a3b00' }}>
                                                                            {variant.current || 0}
                                                                        </strong> 
                                                                        <span className="min-text"> / min {variant.min}</span>
                                                                    </span>
                                                                    
                                                                    <div className="var-adjusters">
                                                                        <button className="adjust-btn" onClick={(e) => handleAdjustStock(e, item.id, variant.id, 1)}>+1</button>
                                                                        <button className="adjust-btn" onClick={(e) => handleAdjustStock(e, item.id, variant.id, -1)}>-1</button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAL */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2 className="modal-title">{modalMode === 'add' ? 'Add new item' : 'Edit item'}</h2>
                        
                        <form onSubmit={handleSubmit} className="modal-form">
                            <div className="form-group">
                                <label>Item name</label>
                                <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                            </div>

                            <div className="form-group">
                                <label>Category</label>
                                <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                                    <option value="Raw Material">Raw Material</option>
                                    <option value="Tool">Tool</option>
                                    <option value="Consumable">Consumable</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Unit of measurement</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. pcs, liters, kg" 
                                    value={formData.unit} 
                                    onChange={(e) => {
                                        const noNumbers = e.target.value.replace(/[0-9]/g, '');
                                        setFormData({...formData, unit: noNumbers});
                                    }} 
                                    required 
                                />
                            </div>

                            <div className="form-group variants-group">
                                <label>Variants <span>(size, color, grade, etc.)</span></label>
                                {formData.variants.map((variant) => (
                                    <div className="variant-input-row" key={variant.id}>
                                        <input type="text" placeholder="Label (e.g. 2x4)" value={variant.name} onChange={(e) => handleVariantChange(variant.id, e.target.value)} required />
                                        <button type="button" className="remove-variant-btn" onClick={() => removeVariantField(variant.id)}>X</button>
                                    </div>
                                ))}
                                <button type="button" className="add-variant-btn" onClick={addVariantField}>+ Add variant</button>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="cancel-btn" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="submit-btn">{modalMode === 'add' ? 'Add Item' : 'Update'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventoryTable;