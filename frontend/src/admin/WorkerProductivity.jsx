import { useState } from "react";

const regularWorkers = [
  { name: "Juan dela Cruz", role: "Carpenter", early: 1, onTime: 1, overdue: 1, accepted: 2, forRepair: 1 },
  { name: "Maria Santos",   role: "Carver",    early: 1, onTime: 1, overdue: 1, accepted: 2, forRepair: 0 },
  { name: "Carlo Cruz",     role: "Carpenter", early: 1, onTime: 1, overdue: 0, accepted: 2, forRepair: 0 },
  { name: "Ben Reyes",      role: "Carpenter", early: 0, onTime: 1, overdue: 1, accepted: 0, forRepair: 2 },
];

const partTimeWorkers = [
  { name: "Pedro Reyes",       role: "Delivery", early: 1, onTime: 0, overdue: 1, accepted: 1, forRepair: 1 },
  { name: "Ana Lim",           role: "Liha",     early: 0, onTime: 2, overdue: 0, accepted: 1, forRepair: 0 },
  { name: "Rico Delos Santos", role: "Painter",  early: 1, onTime: 1, overdue: 0, accepted: 1, forRepair: 1 },
];

const COLS = ["Worker", "Early", "On-Time", "Overdue", "Accepted", "For Repair"];

export default function WorkerProductivity() {
  const [activeTab, setActiveTab] = useState("regular");

  const workers = activeTab === "regular" ? regularWorkers : partTimeWorkers;

  const rows = [...workers];
  while (rows.length < 4) rows.push(null);

  return (
    <div style={{
      fontFamily: "'Georgia', serif",
      flex: 1,
      padding: "48px 52px",
      backgroundColor: "#ffffff",
      minHeight: "100vh",
      boxSizing: "border-box",
    }}>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 0, marginBottom: 0, justifyContent: "center" }}>
        {[
          { key: "regular",  label: "Regular Workers" },
          { key: "parttime", label: "Part-time Workers" },
        ].map(({ key, label }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                padding: "12px 36px",
                fontSize: 15,
                fontWeight: active ? "900" : "700",
                fontFamily: "inherit",
                cursor: "pointer",
                border: "none",
                borderRadius: "8px 8px 0 0",
                background: active ? "#b8a030" : "transparent",
                color: active ? "#fff" : "#5a4a00",
                transition: "background 0.18s, color 0.18s",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Divider ── */}
      <div style={{
        height: 6,
        background: "linear-gradient(to right, #b8a040, #d4c47a, #c8b060)",
        borderRadius: 3,
        marginBottom: 32,
      }} />

      {/* ── Table section ── */}
      <div>
        <div style={{ fontSize: 16, fontWeight: "900", color: "#5a4a00", marginBottom: 16 }}>
          Task Progress &amp; QC Result
        </div>

        <div style={{ border: "1.5px solid #8b7a2a", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
            <thead>
              <tr style={{ background: "#fff" }}>
                {COLS.map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: col === "Worker" ? "14px 20px" : "14px 12px",
                      textAlign: col === "Worker" ? "left" : "center",
                      fontSize: 13,
                      fontWeight: "700",
                      color: "#3a2e00",
                      borderBottom: "2px solid #c8b840",
                      borderRight: col !== "For Repair" ? "1px solid #e8d98a" : "none",
                      whiteSpace: col === "For Repair" ? "pre-line" : "nowrap",
                    }}
                  >
                    {col === "For Repair" ? "For\nRepair" : col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((w, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: i < rows.length - 1 ? "1px solid #e8d98a" : "none",
                    background: "#fff",
                  }}
                >
                  {w ? (
                    <>
                      <td style={{ padding: "14px 20px", borderRight: "1px solid #e8d98a" }}>
                        <div style={{ fontWeight: "900", fontSize: 14, color: "#3a2e00" }}>{w.name}</div>
                        <div style={{ fontSize: 11, color: "#8b7a2a", marginTop: 2 }}>{w.role}</div>
                      </td>
                      {[w.early, w.onTime, w.overdue, w.accepted, w.forRepair].map((val, j) => (
                        <td
                          key={j}
                          style={{
                            padding: "14px 12px",
                            textAlign: "center",
                            fontSize: 15,
                            fontWeight: "700",
                            color: "#3a2e00",
                            borderRight: j < 4 ? "1px solid #e8d98a" : "none",
                          }}
                        >
                          {val}
                        </td>
                      ))}
                    </>
                  ) : (
                    <td colSpan={6} style={{ padding: "18px 20px" }}>&nbsp;</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
