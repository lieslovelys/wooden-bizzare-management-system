import { useState } from "react";

const historyData = [
  { id: "FR-0038", name: "Luxury Frame",         dateStarted: "April 2, 2026",  dateCompleted: "April 16, 2026", remark: "Early" },
  { id: "DR-0039", name: "Slightly Curve Door",  dateStarted: "April 5, 2026",  dateCompleted: "April 30, 2026", remark: "On-time" },
  { id: "FR-0040", name: "Double Standard Frame", dateStarted: "April 8, 2026", dateCompleted: "May 15, 2026",   remark: "Late" },
];

const remarkStyle = {
  Early:   { background: "#3a7a3a", color: "#fff" },
  "On-time": { background: "#c8e8c8", color: "#2a5a2a", border: "1.5px solid #7ab87a" },
  Late:    { background: "#f08080", color: "#fff" },
};

export default function ProjectHistory() {
  const [selected, setSelected] = useState("FR-0038");

  return (
    <div style={{
      fontFamily: "'Georgia', serif",
      flex: 1,
      padding: "48px 56px",
      backgroundColor: "#ffffff",
      minHeight: "100vh",
      boxSizing: "border-box",
    }}>
      {/* Title */}
      <h1 style={{
        margin: "0 0 16px",
        fontSize: 30,
        fontWeight: "900",
        color: "#5a4a00",
        letterSpacing: 1.5,
        textTransform: "uppercase",
        fontFamily: "inherit",
      }}>
        PROJECT HISTORY
      </h1>

      {/* Divider */}
      <div style={{
        height: 6,
        background: "linear-gradient(to right, #b8a040, #d4c47a, #c8b060)",
        borderRadius: 3,
        marginBottom: 28,
      }} />

      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Project ID", "Project Name", "Date Started", "Date Completed", "Remarks"].map((col) => (
              <th key={col} style={{
                padding: "12px 16px",
                textAlign: "left",
                fontSize: 14,
                fontWeight: "900",
                color: "#5a4a00",
                borderBottom: "2px solid #c8b840",
                letterSpacing: 0.3,
              }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {historyData.map((row) => {
            const isSelected = selected === row.id;
            const rm = remarkStyle[row.remark] || { background: "#e8e8e8", color: "#333" };
            return (
              <tr
                key={row.id}
                onClick={() => setSelected(row.id)}
                style={{
                  background: isSelected ? "#c8bfa0" : "#fff",
                  borderBottom: "1px solid #e8d98a",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseOver={e => { if (!isSelected) e.currentTarget.style.background = "rgba(184,160,48,0.08)"; }}
                onMouseOut={e => { if (!isSelected) e.currentTarget.style.background = "#fff"; }}
              >
                <td style={{ padding: "16px 16px", fontSize: 14, fontWeight: "700", color: "#3a2e00" }}>{row.id}</td>
                <td style={{ padding: "16px 16px", fontSize: 14, fontWeight: "700", color: "#3a2e00" }}>{row.name}</td>
                <td style={{ padding: "16px 16px", fontSize: 14, fontWeight: "700", color: "#3a2e00" }}>{row.dateStarted}</td>
                <td style={{ padding: "16px 16px", fontSize: 14, fontWeight: "700", color: "#3a2e00" }}>{row.dateCompleted}</td>
                <td style={{ padding: "16px 16px" }}>
                  <span style={{
                    background: rm.background,
                    color: rm.color,
                    border: rm.border || "none",
                    borderRadius: 20,
                    padding: "5px 18px",
                    fontSize: 13,
                    fontWeight: "700",
                    display: "inline-block",
                  }}>
                    {row.remark}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
