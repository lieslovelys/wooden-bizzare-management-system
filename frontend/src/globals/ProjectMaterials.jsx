import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';

// FR-3 (final clause): records materials consumed by this project. Reuses the existing
// /api/inventory/variants/:variantId/adjust endpoint (tagged with this project's id) rather than
// a separate write path, so stock changes still only ever happen through
// inventoryModel.js's adjustVariantStock transaction — see ARCHITECTURE_REVIEW.md item 18.
const ProjectMaterials = ({ projectId }) => {
    const [materials, setMaterials] = useState([]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [variantId, setVariantId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [mode, setMode] = useState('Used');
    const [submitting, setSubmitting] = useState(false);

    const showToast = useToast();

    const fetchMaterials = async () => {
        try {
            const result = await api.get(`/api/inventory/projects/${projectId}/materials`);
            if (result.success) setMaterials(result.data);
        } catch (error) {
            showToast(error.message || 'Failed to load materials.', 'error');
        }
    };

    useEffect(() => {
        let ignore = false;
        (async () => {
            setLoading(true);
            try {
                const [materialsResult, itemsResult] = await Promise.all([
                    api.get(`/api/inventory/projects/${projectId}/materials`),
                    api.get('/api/inventory'),
                ]);
                if (ignore) return;
                if (materialsResult.success) setMaterials(materialsResult.data);
                if (itemsResult.success) setItems(itemsResult.data);
            } catch (error) {
                if (!ignore) showToast(error.message || 'Failed to load materials.', 'error');
            } finally {
                if (!ignore) setLoading(false);
            }
        })();
        return () => { ignore = true; };
        // showToast (from useToast()) is a stable reference — see ToastProvider.jsx's useCallback.
    }, [projectId, showToast]);

    // Flattened variant options, one per (item, variant) pair, for the record-usage picker.
    const variantOptions = (items || []).flatMap((item) =>
        (item.variants || []).map((variant) => ({
            id: variant.id,
            label: `${item.name} — ${variant.name} (${variant.current} ${item.unit} in stock)`,
        }))
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        const qty = Number(quantity);
        if (!variantId || !Number.isInteger(qty) || qty <= 0) {
            showToast('Choose a variant and a positive whole quantity.', 'error');
            return;
        }

        setSubmitting(true);
        try {
            await api.post(`/api/inventory/variants/${variantId}/adjust`, {
                delta: mode === 'Used' ? -qty : qty,
                reason: mode,
                projectId: Number(projectId),
            });
            showToast(mode === 'Used' ? 'Materials recorded as used.' : 'Materials returned to stock.', 'success');
            setQuantity('');
            fetchMaterials();
            // Re-fetch items too, so the picker's "N in stock" label stays current for the next entry.
            const itemsResult = await api.get('/api/inventory');
            if (itemsResult.success) setItems(itemsResult.data);
        } catch (error) {
            showToast(error.message || 'Failed to record materials.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="jod-container jod-materials-container">
            <div className="jod-progress-header">
                <h3 className="jod-container-title">Materials Used</h3>
            </div>

            {loading ? (
                <p style={{ textAlign: 'center', padding: '20px' }}>Loading materials...</p>
            ) : (
                <table className="jod-table wb-card-table">
                    <thead>
                        <tr>
                            <th>ITEM</th>
                            <th>VARIANT</th>
                            <th>USED</th>
                            <th>RETURNED</th>
                            <th>NET</th>
                        </tr>
                    </thead>
                    <tbody>
                        {materials.map((row) => (
                            <tr key={row.variant_id}>
                                <td data-label="Item">{row.item_name}</td>
                                <td data-label="Variant">{row.variant_name}</td>
                                <td data-label="Used">{row.used} {row.unit}</td>
                                <td data-label="Returned">{row.returned} {row.unit}</td>
                                <td data-label="Net">{row.net_used} {row.unit}</td>
                            </tr>
                        ))}
                        {materials.length === 0 && (
                            <tr><td colSpan="5" style={{ textAlign: 'center', color: '#8b816a' }}>No materials recorded yet.</td></tr>
                        )}
                    </tbody>
                </table>
            )}

            <form className="jod-form" onSubmit={handleSubmit}>
                <div className="jod-form-grid">
                    <div className="jod-form-group">
                        <label>Variant</label>
                        <select value={variantId} onChange={(e) => setVariantId(e.target.value)}>
                            <option value="">-- Select a variant --</option>
                            {variantOptions.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="jod-form-group">
                        <label>Quantity</label>
                        <input
                            type="number"
                            min="1"
                            step="1"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                        />
                    </div>
                    <div className="jod-form-group">
                        <label>Action</label>
                        <select value={mode} onChange={(e) => setMode(e.target.value)}>
                            <option value="Used">Used</option>
                            <option value="Returned">Returned</option>
                        </select>
                    </div>
                </div>
                <div className="jod-form-actions">
                    <button type="submit" className="jod-submit-btn" disabled={submitting}>
                        {mode === 'Used' ? 'Record Usage' : 'Record Return'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ProjectMaterials;
