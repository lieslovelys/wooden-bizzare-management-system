import { useState, useEffect, useCallback } from "react";
import "../css/admin.css";

const API = "http://localhost:8080/api";

async function fetchProjects() {
  try {
    const response = await fetch(`${API}/projects`);
    if (!response.ok) throw new Error("Failed to load projects");
    const result = await response.json();
    if (result.success && result.data) return result.data;
    if (Array.isArray(result)) return result;
    return [];
  } catch (err) {
    console.error("Error fetching projects:", err);
    throw err;
  }
}

async function fetchProfit(projectId) {
  const res = await fetch(`${API}/profit/${projectId}`);
  // If 404, return empty profit data instead of throwing error
  if (res.status === 404) {
    return {
      client_payment: 0,
      worker_wages: 0,
      materials_cost: 0,
      other_expenses: 0,
      expense_items: []
    };
  }
  if (!res.ok) throw new Error("Failed to load profit data");
  return res.json();
}

async function saveProfit(projectId, payload) {
  console.log("Saving profit for project:", projectId, "payload:", payload);
  const res = await fetch(`${API}/profit/${projectId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  console.log("Save response status:", res.status);
  const data = await res.json();
  console.log("Save response data:", data);
  if (!res.ok) throw new Error(data.error || "Failed to save profit data");
  return data;
}

function SpinnerInput({ value, onChange }) {
  return (
    <div className="profit-spinner">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
      <div className="profit-spinner-buttons">
        <button type="button" onClick={() => onChange(value + 500)}>▲</button>
        <button type="button" onClick={() => onChange(Math.max(0, value - 500))}>▼</button>
      </div>
    </div>
  );
}

export default function Profit() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectName, setProjectName] = useState("");

  const [clientPayment, setClientPayment] = useState(0);
  const [workerWages, setWorkerWages] = useState(0);
  const [materialsCost, setMaterialsCost] = useState(0);
  const [otherExpenses, setOtherExpenses] = useState(0);
  const [breakdown, setBreakdown] = useState([]);

  const [saved, setSaved] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // New expense item form
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemAmount, setNewItemAmount] = useState(0);

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
      setSaved(data);
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
    setClientPayment(Number(data.client_payment) || 0);
    setWorkerWages(Number(data.worker_wages) || 0);
    setMaterialsCost(Number(data.materials_cost) || 0);
    setOtherExpenses(Number(data.other_expenses) || 0);
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
        client_payment: clientPayment,
        worker_wages: workerWages,
        materials_cost: materialsCost,
        other_expenses: otherExpenses,
        expense_items: breakdown,
      };
      const updated = await saveProfit(selectedProjectId, payload);
      applyData(updated);
      setSaved(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (saved) applyData(saved);
    setError(null);
    setSuccess(false);
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
    setNewItemAmount(0);
  }

  function removeExpenseItem(index) {
    setBreakdown(breakdown.filter((_, i) => i !== index));
  }

  function updateExpenseItem(index, field, value) {
    const updated = [...breakdown];
    updated[index][field] = field === "amount" ? Number(value) : value;
    setBreakdown(updated);
  }

  const totalExpenses = workerWages + materialsCost + otherExpenses;
  const netProfit = clientPayment - totalExpenses;
  const fmt = (n) => "₱" + Number(n).toLocaleString("en-PH");

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
              <option value="">-- Select a Project --</option>
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
                                value={row.amount}
                                onChange={(e) => updateExpenseItem(i, "amount", e.target.value)}
                                className="profit-table-input profit-table-amount"
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => removeExpenseItem(i)}
                                className="profit-delete-btn"
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