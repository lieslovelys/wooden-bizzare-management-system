import React, { useState, useEffect } from 'react';
import '../css/inventory.css';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { formatProjectId } from '../utils/format';

const ADJUST_REASONS = ['Received', 'Used', 'Damaged', 'Correction', 'Returned'];
// FR-3: only these two reasons can be tagged to a project — see schemas/inventorySchemas.js.
const PROJECT_TAGGABLE_REASONS = ['Used', 'Returned'];

const InventoryTable = () => {
    // P1-11: inventory now persists server-side via /api/inventory instead of localStorage —
    // see ARCHITECTURE_REVIEW.md P1-11. All three roles that mount this screen (Admin,
    // Production Manager, Inventory Staff) now see the same data.
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const [expandedRow, setExpandedRow] = useState(null);
    const [activeFilter, setActiveFilter] = useState('All');

    // Which adjustment reason is currently selected per variant (+1/-1 both use it) — keyed by
    // variant id so each row's dropdown is independent.
    const [reasonByVariant, setReasonByVariant] = useState({});
    // FR-3: which project a Used/Returned adjustment is tagged to, keyed by variant id the same
    // way. '' means untagged (only valid for Used — Returned requires a project).
    const [projectByVariant, setProjectByVariant] = useState({});
    // Open projects for the tagging dropdown — fetched lazily, the first time a row's reason is
    // set to Used or Returned, so the screen's initial load stays at one request.
    const [openProjects, setOpenProjects] = useState(null);

    // States for Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        category: 'Raw Material',
        unit: '',
        variants: []
    });

    const showToast = useToast();

    const fetchItems = async () => {
        const result = await api.get('/api/inventory');
        if (result.success) setItems(result.data);
    };

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                const result = await api.get('/api/inventory');
                if (!ignore && result.success) setItems(result.data);
            } catch (error) {
                if (!ignore) showToast(error.message || 'Failed to load inventory.', 'error');
            } finally {
                if (!ignore) setLoading(false);
            }
        })();
        return () => { ignore = true; };
        // showToast (from useToast()) is a stable reference — see ToastProvider.jsx's
        // useCallback — so including it here doesn't cause a re-fetch loop.
    }, [showToast]);

    const toggleRow = (id) => {
        setExpandedRow(expandedRow === id ? null : id);
    };

    const getReason = (variantId) => reasonByVariant[variantId] || ADJUST_REASONS[0];
    const handleReasonChange = (variantId, reason) => {
        setReasonByVariant(prev => ({ ...prev, [variantId]: reason }));
        if (PROJECT_TAGGABLE_REASONS.includes(reason) && openProjects === null) {
            (async () => {
                try {
                    const result = await api.get('/api/inventory/projects');
                    if (result.success) setOpenProjects(result.data);
                } catch (error) {
                    showToast(error.message || 'Failed to load projects.', 'error');
                }
            })();
        }
    };

    const getProjectId = (variantId) => projectByVariant[variantId] || '';
    const handleProjectChange = (variantId, projectId) => {
        setProjectByVariant(prev => ({ ...prev, [variantId]: projectId }));
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm("Are you sure you want to delete this item?")) return;
        try {
            await api.delete(`/api/inventory/${id}`);
            showToast('Item deleted.', 'success');
            fetchItems();
        } catch (error) {
            showToast(error.message || 'Failed to delete item.', 'error');
        }
    };

    const handleAdjustStock = async (e, itemId, variantId, amount) => {
        e.stopPropagation();
        const reason = getReason(variantId);
        const projectId = getProjectId(variantId);
        try {
            await api.post(`/api/inventory/variants/${variantId}/adjust`, {
                delta: amount,
                reason,
                ...(PROJECT_TAGGABLE_REASONS.includes(reason) && projectId
                    ? { projectId: Number(projectId) }
                    : {}),
            });
            fetchItems();
        } catch (error) {
            showToast(error.message || 'Failed to adjust stock.', 'error');
        }
    };

    // --- MODAL FUNCTIONS ---
    const openAddModal = () => {
        setModalMode('add');
        setFormData({
            name: '', category: 'Raw Material', unit: '',
            variants: [{ id: `new-${Date.now()}`, name: '', minStock: 5 }]
        });
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
            variants: item.variants ? item.variants.map(v => ({ id: v.id, name: v.name, minStock: v.min })) : []
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

    const handleVariantMinStockChange = (id, newMin) => {
        setFormData(prev => ({
            ...prev,
            variants: prev.variants.map(v => v.id === id ? { ...v, minStock: Number(newMin) } : v)
        }));
    };

    const addVariantField = () => {
        setFormData(prev => ({
            ...prev,
            variants: [...prev.variants, { id: `new-${Date.now()}`, name: '', minStock: 5 }]
        }));
    };

    const removeVariantField = (id) => {
        setFormData(prev => ({
            ...prev,
            variants: prev.variants.filter(v => v.id !== id)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const payload = {
            name: formData.name,
            category: formData.category,
            unit: formData.unit,
            variants: formData.variants
                .filter(v => v.name.trim() !== '')
                .map(v => ({
                    // A server-assigned id is a number; anything added client-side in this modal
                    // (add mode, or a new row added while editing) carries a string "new-…" id —
                    // omit it so the backend treats it as a new variant rather than an update.
                    id: typeof v.id === 'number' ? v.id : undefined,
                    name: v.name,
                    minStock: v.minStock,
                })),
        };

        try {
            if (modalMode === 'add') {
                await api.post('/api/inventory', payload);
                showToast('Item added.', 'success');
            } else {
                await api.put(`/api/inventory/${editingItem.id}`, payload);
                showToast('Item updated.', 'success');
            }
            closeModal();
            fetchItems();
        } catch (error) {
            showToast(error.message || 'Failed to save item.', 'error');
        }
    };

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

            {loading ? (
                <p style={{ textAlign: 'center', padding: '20px' }}>Loading inventory...</p>
            ) : (
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
                                                                        <select
                                                                            className="reason-select"
                                                                            value={getReason(variant.id)}
                                                                            onChange={(e) => handleReasonChange(variant.id, e.target.value)}
                                                                            title="Reason for adjustment"
                                                                        >
                                                                            {ADJUST_REASONS.map(r => (
                                                                                <option key={r} value={r}>{r}</option>
                                                                            ))}
                                                                        </select>
                                                                        {/* FR-3: 'Used' consumes stock (only -1 makes sense) and 'Returned' restores
                                                                            it (only +1 makes sense, and it requires a project) — see
                                                                            schemas/inventorySchemas.js's adjustBody for the same rule enforced
                                                                            server-side. */}
                                                                        {PROJECT_TAGGABLE_REASONS.includes(getReason(variant.id)) && (
                                                                            <select
                                                                                className="project-select"
                                                                                value={getProjectId(variant.id)}
                                                                                onChange={(e) => handleProjectChange(variant.id, e.target.value)}
                                                                                title="Project"
                                                                            >
                                                                                {getReason(variant.id) === 'Used' && <option value="">— No project —</option>}
                                                                                {getReason(variant.id) === 'Returned' && <option value="">— Select a project —</option>}
                                                                                {(openProjects || []).map(p => (
                                                                                    <option key={p.id} value={p.id}>{formatProjectId(p.id)} — {p.project_name}</option>
                                                                                ))}
                                                                            </select>
                                                                        )}
                                                                        <button
                                                                            className="adjust-btn"
                                                                            disabled={getReason(variant.id) === 'Used' || (getReason(variant.id) === 'Returned' && !getProjectId(variant.id))}
                                                                            onClick={(e) => handleAdjustStock(e, item.id, variant.id, 1)}
                                                                        >+1</button>
                                                                        <button
                                                                            className="adjust-btn"
                                                                            disabled={getReason(variant.id) === 'Returned'}
                                                                            onClick={(e) => handleAdjustStock(e, item.id, variant.id, -1)}
                                                                        >-1</button>
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
            )}

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
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="Min stock"
                                            className="variant-min-input"
                                            value={variant.minStock}
                                            onChange={(e) => handleVariantMinStockChange(variant.id, e.target.value)}
                                        />
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
