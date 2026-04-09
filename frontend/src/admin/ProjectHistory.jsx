import { useState } from "react";
import "../css/admin.css";

const historyData = [
  { id: "FR-0038", name: "Luxury Frame",         dateStarted: "April 2, 2026",  dateCompleted: "April 16, 2026", remark: "Early" },
  { id: "DR-0039", name: "Slightly Curve Door",  dateStarted: "April 5, 2026",  dateCompleted: "April 30, 2026", remark: "On-time" },
  { id: "FR-0040", name: "Double Standard Frame", dateStarted: "April 8, 2026", dateCompleted: "May 15, 2026",   remark: "Late" },
];

const remarkClasses = {
  Early:   "history-remark-early",
  "On-time": "history-remark-ontime",
  Late:    "history-remark-late",
};

export default function ProjectHistory() {
  const [selected, setSelected] = useState("FR-0038");

  return (
    <div className="history-container">
      <h1 className="history-title">
        PROJECT HISTORY
      </h1>

      <div className="history-divider" />

      <table className="history-table">
        <thead>
          <tr>
            {["Project ID", "Project Name", "Date Started", "Date Completed", "Remarks"].map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {historyData.map((row) => {
            const isSelected = selected === row.id;
            const remarkClass = remarkClasses[row.remark] || "";
            return (
              <tr
                key={row.id}
                onClick={() => setSelected(row.id)}
                className={`history-row ${isSelected ? "selected" : ""}`}
              >
                <td>{row.id}</td>
                <td>{row.name}</td>
                <td>{row.dateStarted}</td>
                <td>{row.dateCompleted}</td>
                <td>
                  <span className={`history-remark ${remarkClass}`}>
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
