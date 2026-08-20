import { useState, useEffect, useCallback } from "react";
import "../css/admin.css";
import { api, ApiError } from "../api/client";
import { formatCurrency } from "../utils/format";

// P1-3: /api/projects is now paged with a 25-row default — this dropdown wants every project
// (including Completed ones, unlike globals/ProjectList.jsx, since profit can be entered for a
// finished project too), so it asks for the backend's hard cap explicitly rather than inheriting
// the smaller default. See ARCHITECTURE_REVIEW.md P1-3.
async function fetchProjects() {
  const result = await api.get("/api/projects?limit=200");
  if (result.success && result.data) return result.data;
  if (Array.isArray(result)) return result;
  return [];
}

async function fetchProfit(projectId) {
  try {
    return await api.get(`/api/profit/${projectId}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return {
        client_payment: "",
        worker_wages: "",
        materials_cost: "",
        other_expenses: "",
        expense_items: []
      };
    }
    throw err;
  }
}

async function saveProfit(projectId, payload) {
  return api.post(`/api/profit/${projectId}`, payload);
}

function SpinnerInput({ value, onChange }) {
  return (
    <div className="profit-spinner">
      <input
        type="number"
        value={value}
        placeholder="0"
        onChange={(e) => {
          const val = e.target.value;
          // Kapag binura lahat ng text, hayaan lang maging blangko ("")
          onChange(val === "" ? "" : Number(val));
        }}
      />
      <div className="profit-spinner-buttons">
        {/* Sinisiguro natin na mako-convert sa number ang blank ("") bago mag-add */}
        <button type="button" onClick={() => onChange((Number(value) || 0) + 500)}>▲</button>
        <button type="button" onClick={() => onChange(Math.max(0, (Number(value) || 0) - 500))}>▼</button>
      </div>
    </div>
  );
}

export default function Profit() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectName, setProjectName] = useState("");

  // Pinalitan natin ng "" (empty string) ang default imbes na 0
  const [clientPayment, setClientPayment] = useState("");
  const [workerWages, setWorkerWages] = useState("");
  const [materialsCost, setMaterialsCost] = useState("");
  const [otherExpenses, setOtherExpenses] = useState("");
  const [breakdown, setBreakdown] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemAmount, setNewItemAmount] = useState("");

  useEffect(() => {
    fetchProjects()
      .then((data) => {
        console.log("Projects loaded:", data);
        setProjects(data);
      })
      .catch((err) => {
        console.error("Error fetching projects:", err);
        setError(err.message);
      })
      .finally(() => {
        console.log("Loading projects finished");
        setLoadingProjects(false);
      });
  }, []);

  const loadProfitData = useCallback(async (projectId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProfit(projectId);
      applyData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadProfitData(selectedProjectId);
    } else {
      setLoading(false);
    }
  }, [selectedProjectId, loadProfitData]);

  function applyData(data) {
    // Kapag zero o wala pang laman sa DB, ibabato niya as "" (blangko) para hindi "0" agad ang nakasulat
    setClientPayment(data.client_payment ? Number(data.client_payment) : "");
    setWorkerWages(data.worker_wages ? Number(data.worker_wages) : "");
    setMaterialsCost(data.materials_cost ? Number(data.materials_cost) : "");
    setOtherExpenses(data.other_expenses ? Number(data.other_expenses) : "");
    setBreakdown(data.expense_items || []);
  }

  async function handleSave() {
    if (!selectedProjectId) {
      setError("Please select a project first");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const payload = {
        // Kino-convert natin sa number ang mga blangko para hindi mag-error ang database
        client_payment: Number(clientPayment) || 0,
        worker_wages: Number(workerWages) || 0,
        materials_cost: Number(materialsCost) || 0,
        other_expenses: Number(otherExpenses) || 0,
        expense_items: breakdown,
      };
      const updated = await saveProfit(selectedProjectId, payload);
      applyData(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    window.location.reload();
  }

  function handleProjectChange(e) {
    const projId = e.target.value;
    const proj = projects.find(p => p.id === projId);
    setSelectedProjectId(projId);
    setProjectName(proj?.project_name || "");
  }

  function addExpenseItem() {
    if (!newItemDesc.trim()) {
      setError("Please enter an expense description");
      return;
    }
    const newItem = {
      description: newItemDesc,
      amount: Number(newItemAmount) || 0,
      category: "Other Expenses"
    };
    setBreakdown([...breakdown, newItem]);
    setNewItemDesc("");
    setNewItemAmount("");
  }

  function removeExpenseItem(index) {
    setBreakdown(breakdown.filter((_, i) => i !== index));
  }

  function updateExpenseItem(index, field, value) {
    const updated = [...breakdown];
    updated[index][field] = field === "amount" ? (value === "" ? "" : Number(value)) : value;
    setBreakdown(updated);
  }

  // Ligtas na pag-compute kahit blangko ang textbox
  const calcWages = Number(workerWages) || 0;
  const calcMaterials = Number(materialsCost) || 0;
  const calcOther = Number(otherExpenses) || 0;
  const calcPayment = Number(clientPayment) || 0;

  const totalExpenses = calcWages + calcMaterials + calcOther;
  const netProfit = calcPayment - totalExpenses;
  const fmt = formatCurrency;

  if (loadingProjects) {
    return (
      <div className="profit-container">
        <div className="profit-card">
          <p style={{ textAlign: "center", padding: "2rem", opacity: 0.5 }}>
            Loading projects...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="profit-container">
      
      {/* CSS FIX PARA MA-HIDE ANG DEFAULT BROWSER ARROWS */}
      <style>{`
        .profit-spinner input[type="number"]::-webkit-inner-spin-button,
        .profit-spinner input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .profit-spinner input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>

      <div className="profit-card">
        <h2 className="profit-title">
          Profit Detail {projectName ? `— ${projectName}` : ""}
        </h2>

        <div className="profit-project-select">
          <label className="profit-input-label">Select Project</label>
          {loadingProjects ? (
            <p style={{ textAlign: "center", padding: "1rem", opacity: 0.5 }}>Loading projects...</p>
          ) : projects.length === 0 ? (
            <p style={{ textAlign: "center", padding: "1rem", opacity: 0.5 }}>No projects found</p>
          ) : (
            <select
              className="profit-form-select"
              value={selectedProjectId}
              onChange={handleProjectChange}
            >
              <option value="">Select a Project</option>
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.project_name || proj.id}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedProjectId && (
          <>
            {error && (
              <div className="profit-banner profit-banner--error">{error}</div>
            )}
            {success && (
              <div className="profit-banner profit-banner--success">
                Changes saved successfully.
              </div>
            )}

            {loading ? (
              <p style={{ textAlign: "center", padding: "2rem", opacity: 0.5 }}>
                Loading profit data...
              </p>
            ) : (
              <>
                <div className="profit-input-grid">
                  {[
                    { label: "Client Payment (₱)", value: clientPayment, setter: setClientPayment },
                    { label: "Worker Wages (₱)", value: workerWages, setter: setWorkerWages },
                    { label: "Materials Cost (₱)", value: materialsCost, setter: setMaterialsCost },
                    { label: "Other Expenses (₱)", value: otherExpenses, setter: setOtherExpenses },
                  ].map(({ label, value, setter }) => (
                    <div key={label}>
                      <label className="profit-input-label">{label}</label>
                      <SpinnerInput value={value} onChange={setter} />
                    </div>
                  ))}
                </div>

                <div className="profit-summary">
                  <div className="profit-summary-row">
                    <span className="profit-summary-label">Total Expenses</span>
                    <span className="profit-summary-value">{fmt(totalExpenses)}</span>
                  </div>
                  <div className="profit-summary-row">
                    <span className="profit-net-label">Net Profit</span>
                    <span className="profit-net-value">{fmt(netProfit)}</span>
                  </div>
                </div>

                <div className="profit-breakdown-section">
                  <div className="profit-breakdown-title">Expense Breakdown</div>
                  
                  {/* Add new expense item */}
                  <div className="profit-add-item">
                    <input
                      type="text"
                      placeholder="Expense description"
                      value={newItemDesc}
                      onChange={(e) => setNewItemDesc(e.target.value)}
                      className="profit-add-input"
                    />
                    <input
                      type="number"
                      placeholder="Amount"
                      value={newItemAmount}
                      onChange={(e) => setNewItemAmount(e.target.value)}
                      className="profit-add-input profit-add-amount"
                    />
                    <button type="button" onClick={addExpenseItem} className="profit-add-btn">
                      + Add
                    </button>
                  </div>

                  <table className="profit-table">
                    <thead>
                      <tr>
                        <th>Expense Item</th>
                        <th>Amount</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {breakdown.length === 0 ? (
                        <tr>
                          <td colSpan={3} style={{ textAlign: "center", opacity: 0.5 }}>
                            No breakdown items yet.
                          </td>
                        </tr>
                      ) : (
                        breakdown.map((row, i) => (
                          <tr key={i}>
                            <td>
                              <input
                                type="text"
                                value={row.description}
                                onChange={(e) => updateExpenseItem(i, "description", e.target.value)}
                                className="profit-table-input"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={row.amount === 0 && row.amount !== "" ? "" : row.amount}
                                placeholder="0"
                                onChange={(e) => updateExpenseItem(i, "amount", e.target.value)}
                                className="profit-table-input profit-table-amount"
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => removeExpenseItem(i)}
                                className="profit-delete-btn"
                                title="Delete"
                              >
                                🗑
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="profit-buttons">
                  <button
                    className="profit-btn profit-btn-cancel"
                    onClick={handleCancel}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    className="profit-btn profit-btn-save"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
