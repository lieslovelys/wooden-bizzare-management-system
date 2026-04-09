import { useState } from "react";
import "../css/admin.css";

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
    <div className="productivity-container">
      <div className="productivity-tabs">
        {[
          { key: "regular",  label: "Regular Workers" },
          { key: "parttime", label: "Part-time Workers" },
        ].map(({ key, label }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`productivity-tab ${active ? "active" : ""}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="productivity-divider" />

      <div>
        <div className="productivity-table-title">
          Task Progress &amp; QC Result
        </div>

        <div className="productivity-table-container">
          <table className="productivity-table">
            <thead>
              <tr>
                {COLS.map((col) => (
                  <th key={col}>
                    {col === "For Repair" ? "For\nRepair" : col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((w, i) => (
                <tr key={i}>
                  {w ? (
                    <>
                      <td>
                        <div className="productivity-worker-name">{w.name}</div>
                        <div className="productivity-worker-role">{w.role}</div>
                      </td>
                      {[w.early, w.onTime, w.overdue, w.accepted, w.forRepair].map((val, j) => (
                        <td key={j}>{val}</td>
                      ))}
                    </>
                  ) : (
                    <td colSpan={6}></td>
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
