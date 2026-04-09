import { useState } from "react";
import "../css/admin.css";

const initialWorkers = [
  { id: "W-01", name: "Juan dela Cruz", type: "Regular", role: "Carpenter", contact: "09123456789", status: "Active", projects: [{ name: "Rustic Frame", status: "Completed" }, { name: "Dragon Frame", status: "Ongoing" }] },
  { id: "W-02", name: "Maria Santos", type: "Regular", role: "Carver", contact: "09123456789", status: "Active", projects: [] },
  { id: "W-03", name: "Pedro Reyes", type: "Part-Time", role: "Liha", contact: "09123456789", status: "Active", projects: [] },
  { id: "W-04", name: "Carlo Cruz", type: "Regular", role: "Carver", contact: "09123456789", status: "Active", projects: [] },
];

const roles = ["Carver", "Carpenter", "Liha", "Finisher", "Assembler"];

const typeColors = {
  Regular: { bg: "#f5e6b0", text: "#7a6a00" },
  "Part-Time": { bg: "#b3d4f5", text: "#1a4a7a" },
};

export default function WorkerList() {
  const [workers, setWorkers] = useState(initialWorkers);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewWorker, setViewWorker] = useState(null);

  const [form, setForm] = useState({
    name: "",
    type: "Regular",
    role: "Carver",
    contact: "",
    dailyRate: "0.0",
  });

  const filtered = workers.filter((w) => {
    const matchSearch =
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.type.toLowerCase().includes(search.toLowerCase()) ||
      w.role.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  const handleAdd = () => {
    if (!form.name.trim()) return;
    const newId = `W-${String(workers.length + 1).padStart(2, "0")}`;
    setWorkers([
      ...workers,
      {
        id: newId,
        name: form.name,
        type: form.type,
        role: form.role,
        contact: form.contact,
        status: "Active",
        projects: [],
      },
    ]);
    setForm({ name: "", type: "Regular", role: "Carver", contact: "", dailyRate: "0.0" });
    setShowAddModal(false);
  };

  return (
    <div className="worker-list-container">
      <div className="worker-search">
        <div className="worker-search-box">
          <span className="worker-search-icon">🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search employee's name or account type..."
            className="worker-search-input"
          />
        </div>
      </div>

      <div className="worker-table-container">
        <div className="worker-table-header">
          Worker List
        </div>
        <table className="worker-table">
          <thead>
            <tr>
              {["ID", "NAME", "TYPE", "ROLE", "CONTACT #", "ACTION"].map(col => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(7)].map((_, i) => {
              const w = filtered[i];
              return (
                <tr key={i}>
                  {w ? (
                    <>
                      <td>{w.id}</td>
                      <td>{w.name}</td>
                      <td>
                        <span className={`worker-type-badge ${w.type === "Regular" ? "worker-type-regular" : "worker-type-parttime"}`}>{w.type}</span>
                      </td>
                      <td>{w.role}</td>
                      <td>{w.contact}</td>
                      <td>
                        <button
                          onClick={() => setViewWorker(w)}
                          className="worker-action-btn"
                        >View</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td colSpan={6}></td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="worker-add-btn">
        <button onClick={() => setShowAddModal(true)}>+ Add Worker</button>
      </div>

      {showAddModal && (
        <div className="worker-modal-overlay">
          <div className="worker-modal">
            <h2 className="worker-modal-title">Add Worker</h2>
            <div className="worker-form-grid">
              <div>
                <label className="worker-form-label">Full Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="worker-form-input"
                />
              </div>
              <div>
                <label className="worker-form-label">Worker Type</label>
                <div className="worker-select-wrapper">
                  <select
                    value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value })}
                    className="worker-form-select"
                  >
                    <option>Regular</option>
                    <option>Part-Time</option>
                  </select>
                  <span className="worker-select-arrow">▼</span>
                </div>
              </div>
              <div>
                <label className="worker-form-label">Role / Specialization</label>
                <div className="worker-select-wrapper">
                  <select
                    value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value })}
                    className="worker-form-select"
                  >
                    {roles.map(r => <option key={r}>{r}</option>)}
                  </select>
                  <span className="worker-select-arrow">▼</span>
                </div>
              </div>
              <div>
                <label className="worker-form-label">Contact Number</label>
                <input
                  value={form.contact}
                  onChange={e => setForm({ ...form, contact: e.target.value })}
                  className="worker-form-input"
                />
              </div>
              <div>
                <label className="worker-form-label">Daily Rate (₱)</label>
                <input
                  value={form.dailyRate}
                  onChange={e => setForm({ ...form, dailyRate: e.target.value })}
                  type="number"
                  className="worker-form-input"
                />
              </div>
            </div>
            <div className="worker-form-actions">
              <button onClick={() => setShowAddModal(false)} className="worker-form-cancel-btn">Cancel</button>
              <button onClick={handleAdd} className="worker-form-submit-btn">Add Worker</button>
            </div>
          </div>
        </div>
      )}

      {viewWorker && (
        <div className="worker-modal-overlay">
          <div className="worker-view-modal">
            <div className="worker-view-header">
              <div className="worker-view-avatar">
                {viewWorker.name.charAt(0)}
              </div>
              <div className="worker-view-info">
                <div className="worker-view-info-box">
                  <div className="worker-view-name">{viewWorker.name.toUpperCase().split(" ").reverse().join(", ")}</div>
                  <div className="worker-view-id">WB-{viewWorker.id.replace("W-", "000")}</div>
                </div>
                <div className="worker-view-info-box">
                  <div className="worker-view-role">{viewWorker.role}</div>
                  <div className="worker-view-type">{viewWorker.type}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="worker-view-projects-title">Projects</div>
              <table className="worker-view-table">
                <thead>
                  <tr>
                    <th>Project Name</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {viewWorker.projects.length > 0 ? viewWorker.projects.map((p, i) => (
                    <tr key={i}>
                      <td>{p.name}</td>
                      <td>{p.status}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={2} className="worker-view-empty">No projects assigned</td></tr>
                  )}
                  {[...Array(Math.max(0, 2 - viewWorker.projects.length))].map((_, i) => (
                    <tr key={`empty-${i}`}>
                      <td></td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="worker-view-cancel">
              <button onClick={() => setViewWorker(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
