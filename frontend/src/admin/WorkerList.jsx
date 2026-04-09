import { useState } from "react";

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
    <div style={{ fontFamily: "'Georgia', serif", flex: 1, padding: "32px 40px", backgroundColor: "#ffffff", minHeight: "100vh", boxSizing: "border-box" }}>
      {/* Search & Filters */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 32, alignItems: "center" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "#e8d98a", borderRadius: 24, padding: "10px 20px",
          width: "100%", maxWidth: 460, border: "1.5px solid #c8b840"
        }}>
          <span style={{ fontSize: 16, color: "#7a6a00" }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search employee's name or account type..."
            style={{
              border: "none", background: "transparent", outline: "none",
              fontSize: 14, color: "#5a4a00", width: "100%",
              fontFamily: "inherit"
            }}
          />
        </div>
      </div>

      {/* Worker List Table */}
      <div style={{
        border: "2px solid #8b7a2a", borderRadius: 12, overflow: "hidden",
        boxShadow: "0 2px 12px rgba(100,80,0,0.08)"
      }}>
        {/* Table Header Bar */}
        <div style={{
          background: "#5a4a00", color: "#fff",
          padding: "14px 24px", fontSize: 17, fontWeight: "bold",
          letterSpacing: 0.5
        }}>
          Worker List
        </div>

        {/* Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
          <thead>
            <tr style={{ background: "#fff" }}>
              {["ID", "NAME", "TYPE", "ROLE", "CONTACT #", "ACTION"].map(col => (
                <th key={col} style={{
                  padding: "14px 16px", fontSize: 13, fontWeight: "bold",
                  color: "#3a2e00", textAlign: "center",
                  borderBottom: "2px solid #d4b84a", letterSpacing: 1
                }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(7)].map((_, i) => {
              const w = filtered[i];
              return (
                <tr key={i} style={{
                  borderBottom: "1px solid #e8d98a",
                  background: i % 2 === 0 ? "#fff" : "#fdf9ee"
                }}>
                  {w ? (
                    <>
                      <td style={{ padding: "14px 16px", textAlign: "center", fontSize: 14, color: "#3a2e00" }}>{w.id}</td>
                      <td style={{ padding: "14px 16px", textAlign: "center", fontSize: 14, color: "#3a2e00" }}>{w.name}</td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <span style={{
                          background: typeColors[w.type]?.bg || "#e8e8e8",
                          color: typeColors[w.type]?.text || "#333",
                          borderRadius: 20, padding: "4px 14px",
                          fontSize: 13, fontWeight: 500
                        }}>{w.type}</span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center", fontSize: 14, color: "#3a2e00" }}>{w.role}</td>
                      <td style={{ padding: "14px 16px", textAlign: "center", fontSize: 14, color: "#3a2e00" }}>{w.contact}</td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <button
                          onClick={() => setViewWorker(w)}
                          style={{
                            background: "#8b7a2a", color: "#fff",
                            border: "none", borderRadius: 8,
                            padding: "7px 22px", fontSize: 13,
                            cursor: "pointer", fontFamily: "inherit",
                            fontWeight: 600, transition: "background 0.2s"
                          }}
                          onMouseOver={e => e.target.style.background = "#5a4a00"}
                          onMouseOut={e => e.target.style.background = "#8b7a2a"}
                        >View</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: "14px 16px" }} colSpan={6}>&nbsp;</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Worker Button */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            background: "#8b7a2a", color: "#fff",
            border: "none", borderRadius: 10,
            padding: "12px 28px", fontSize: 15,
            cursor: "pointer", fontFamily: "inherit",
            fontWeight: 600, letterSpacing: 0.5,
            boxShadow: "0 2px 8px rgba(100,80,0,0.15)",
            transition: "background 0.2s"
          }}
          onMouseOver={e => e.target.style.background = "#5a4a00"}
          onMouseOut={e => e.target.style.background = "#8b7a2a"}
        >+ Add Worker</button>
      </div>

      {/* Add Worker Modal */}
      {showAddModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
        }}>
          <div style={{
            background: "#fdf8ee", borderRadius: 16, padding: "36px 40px",
            width: 560, boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
            border: "1.5px solid #c8b840"
          }}>
            <h2 style={{ margin: "0 0 28px", fontSize: 20, color: "#3a2e00", fontFamily: "inherit" }}>Add Worker</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px 24px" }}>
              {/* Full Name */}
              <div style={{ gridColumn: "1" }}>
                <label style={{ fontSize: 13, color: "#3a2e00", fontWeight: 600, display: "block", marginBottom: 6 }}>Full Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  style={{
                    width: "100%", borderRadius: 24, border: "1.5px solid #8b7a2a",
                    padding: "10px 16px", fontSize: 14, fontFamily: "inherit",
                    background: "#fff", boxSizing: "border-box", outline: "none"
                  }}
                />
              </div>
              {/* Worker Type */}
              <div style={{ gridColumn: "2" }}>
                <label style={{ fontSize: 13, color: "#3a2e00", fontWeight: 600, display: "block", marginBottom: 6 }}>Worker Type</label>
                <div style={{ position: "relative" }}>
                  <select
                    value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value })}
                    style={{
                      width: "100%", borderRadius: 24, border: "1.5px solid #8b7a2a",
                      padding: "10px 16px", fontSize: 14, fontFamily: "inherit",
                      background: "#fff", appearance: "none", cursor: "pointer", outline: "none"
                    }}
                  >
                    <option>Regular</option>
                    <option>Part-Time</option>
                  </select>
                  <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#8b7a2a", pointerEvents: "none" }}>▼</span>
                </div>
              </div>
              {/* Role */}
              <div style={{ gridColumn: "1" }}>
                <label style={{ fontSize: 13, color: "#3a2e00", fontWeight: 600, display: "block", marginBottom: 6 }}>Role / Specialization</label>
                <div style={{ position: "relative" }}>
                  <select
                    value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value })}
                    style={{
                      width: "100%", borderRadius: 24, border: "1.5px solid #8b7a2a",
                      padding: "10px 16px", fontSize: 14, fontFamily: "inherit",
                      background: "#fff", appearance: "none", cursor: "pointer", outline: "none"
                    }}
                  >
                    {roles.map(r => <option key={r}>{r}</option>)}
                  </select>
                  <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#8b7a2a", pointerEvents: "none" }}>▼</span>
                </div>
              </div>
              {/* Contact */}
              <div style={{ gridColumn: "2" }}>
                <label style={{ fontSize: 13, color: "#3a2e00", fontWeight: 600, display: "block", marginBottom: 6 }}>Contact Number</label>
                <input
                  value={form.contact}
                  onChange={e => setForm({ ...form, contact: e.target.value })}
                  style={{
                    width: "100%", borderRadius: 24, border: "1.5px solid #8b7a2a",
                    padding: "10px 16px", fontSize: 14, fontFamily: "inherit",
                    background: "#fff", boxSizing: "border-box", outline: "none"
                  }}
                />
              </div>
              {/* Daily Rate */}
              <div style={{ gridColumn: "1" }}>
                <label style={{ fontSize: 13, color: "#3a2e00", fontWeight: 600, display: "block", marginBottom: 6 }}>Daily Rate (₱)</label>
                <input
                  value={form.dailyRate}
                  onChange={e => setForm({ ...form, dailyRate: e.target.value })}
                  type="number"
                  style={{
                    width: "100%", borderRadius: 24, border: "1.5px solid #8b7a2a",
                    padding: "10px 16px", fontSize: 14, fontFamily: "inherit",
                    background: "#fff", boxSizing: "border-box", outline: "none"
                  }}
                />
              </div>
            </div>
            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 14, marginTop: 28 }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  background: "#5a4a00", color: "#fff", border: "none",
                  borderRadius: 24, padding: "10px 28px", fontSize: 14,
                  cursor: "pointer", fontFamily: "inherit", fontWeight: 600
                }}
              >Cancel</button>
              <button
                onClick={handleAdd}
                style={{
                  background: "#3a2e00", color: "#fff", border: "none",
                  borderRadius: 24, padding: "10px 28px", fontSize: 14,
                  cursor: "pointer", fontFamily: "inherit", fontWeight: 600
                }}
              >Add Worker</button>
            </div>
          </div>
        </div>
      )}

      {/* View Worker Modal */}
      {viewWorker && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
        }}>
          <div style={{
            background: "#fdf8ee", borderRadius: 16, padding: "36px 40px",
            width: 580, boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
            border: "1.5px solid #c8b840"
          }}>
            {/* Worker Header */}
            <div style={{ display: "flex", gap: 20, alignItems: "stretch", marginBottom: 28 }}>
              {/* Photo placeholder */}
              <div style={{
                width: 100, height: 100, borderRadius: 8,
                background: "#c8b840", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 36, color: "#fff", fontWeight: "bold"
              }}>
                {viewWorker.name.charAt(0)}
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{
                  background: "#5a4a00", color: "#fff",
                  borderRadius: 8, padding: "10px 18px"
                }}>
                  <div style={{ fontWeight: "bold", fontSize: 17, letterSpacing: 0.5 }}>
                    {viewWorker.name.toUpperCase().split(" ").reverse().join(", ")}
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>
                    WB-{viewWorker.id.replace("W-", "000")}
                  </div>
                </div>
                <div style={{
                  background: "#5a4a00", color: "#fff",
                  borderRadius: 8, padding: "10px 18px"
                }}>
                  <div style={{ fontWeight: "bold", fontSize: 15 }}>{viewWorker.role}</div>
                  <div style={{ fontSize: 13, opacity: 0.85 }}>{viewWorker.type}</div>
                </div>
              </div>
            </div>

            {/* Projects */}
            <div>
              <div style={{ fontSize: 15, color: "#5a4a00", fontWeight: "bold", marginBottom: 12 }}>Projects</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "8px 16px", textAlign: "center", color: "#8b7a2a", fontSize: 13, borderBottom: "1.5px solid #c8b840", fontWeight: 600 }}>Project Name</th>
                    <th style={{ padding: "8px 16px", textAlign: "center", color: "#8b7a2a", fontSize: 13, borderBottom: "1.5px solid #c8b840", fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {viewWorker.projects.length > 0 ? viewWorker.projects.map((p, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #e8d98a" }}>
                      <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: "bold", fontSize: 14, color: "#3a2e00" }}>{p.name}</td>
                      <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: "bold", fontSize: 14, color: "#3a2e00" }}>{p.status}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={2} style={{ padding: "16px", textAlign: "center", color: "#8b7a2a", fontSize: 13 }}>No projects assigned</td></tr>
                  )}
                  {/* Empty rows */}
                  {[...Array(Math.max(0, 2 - viewWorker.projects.length))].map((_, i) => (
                    <tr key={`empty-${i}`} style={{ borderBottom: "1px solid #e8d98a" }}>
                      <td style={{ padding: "12px 16px" }}>&nbsp;</td>
                      <td style={{ padding: "12px 16px" }}>&nbsp;</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cancel */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <button
                onClick={() => setViewWorker(null)}
                style={{
                  background: "#8b7a2a", color: "#fff", border: "none",
                  borderRadius: 24, padding: "10px 32px", fontSize: 14,
                  cursor: "pointer", fontFamily: "inherit", fontWeight: 600
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
