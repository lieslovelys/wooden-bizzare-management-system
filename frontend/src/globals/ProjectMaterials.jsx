import React, { useEffect, useId, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';

// FR-3 (final clause): records materials consumed by this project. Reuses the existing
// /api/inventory/variants/:variantId/adjust endpoint (tagged with this project's id) rather than
// a separate write path, so stock changes still only ever happen through
// inventoryModel.js's adjustVariantStock transaction — see ARCHITECTURE_REVIEW.md item 18.
const ProjectMaterials = ({ projectId }) => {
    const id = useId();
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
        <div className="wb-panel jod-materials-panel">
            <div className="wb-panel__header">
                <h2 className="wb-panel__title">Materials used</h2>
            </div>

            {loading ? (
                <p className="wb-field__hint" style={{ textAlign: 'center', padding: '20px' }}>Loading materials...</p>
            ) : (
                <table className="jod-table wb-card-table wb-table">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Variant</th>
                            <th>Used</th>
                            <th>Returned</th>
                            <th>Net</th>
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
                            <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No materials recorded yet.</td></tr>
                        )}
                    </tbody>
                </table>
            )}

            <form className="wb-panel__body jod-form" onSubmit={handleSubmit}>
                <div className="jod-form-grid jod-form-grid--3">
                    <div className="wb-field">
                        <label className="wb-field__label" htmlFor={`${id}-variant`}>Variant</label>
                        <select id={`${id}-variant`} className="wb-input" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
                            <option value="">-- Select a variant --</option>
                            {variantOptions.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="wb-field">
                        <label className="wb-field__label" htmlFor={`${id}-quantity`}>Quantity</label>
                        <input
                            id={`${id}-quantity`}
                            type="number"
                            className="wb-input"
                            min="1"
                            step="1"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                        />
                    </div>
                    <div className="wb-field">
                        <label className="wb-field__label" htmlFor={`${id}-action`}>Action</label>
                        <select id={`${id}-action`} className="wb-input" value={mode} onChange={(e) => setMode(e.target.value)}>
                            <option value="Used">Used</option>
                            <option value="Returned">Returned</option>
                        </select>
                    </div>
                </div>
                <div className="jod-form-actions">
                    <button type="submit" className="wb-btn wb-btn--primary" disabled={submitting}>
                        {mode === 'Used' ? 'Record Usage' : 'Record Return'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ProjectMaterials;
