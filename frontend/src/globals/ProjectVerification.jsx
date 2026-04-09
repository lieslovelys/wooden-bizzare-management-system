import { useState } from "react";

const projects = [
  {
    id: "FR-0038",
    name: "LUXURY FRAME",
    displayName: "Luxury Frame",
    dateOrdered: "April 1, 2026",
    dueDate: "May 25, 2026",
    dueDateColor: "#cc3300",
    priority: "High",
    priorityColor: "#cc3300",
    details: {
      Size: "Deep Shadow Boxes (50mm+ depth): Used for 3D memorabilia or to create a 3D float effect, enhancing the depth and presence of an object.",
      Color: "Brushed Gold & Warm Metallics (Champagne/Brass): The defining metal finish, offering a muted, sophisticated glow rather than bright yellow gold.",
    },
    totalStages: 6,
    stages: [
      { stage: "Carpenter", worker: "John Kenneth Juralbal", startDate: "04/5/26", dueDate: "04/23/26", status: "approved" },
      { stage: "Carver", worker: "Laurence Orot", startDate: "04/25/26", dueDate: "05/15/26", status: "pending" },
    ],
  },
  {
    id: "FR-0088",
    name: "STRANDED FRAME",
    displayName: "Stranded Frame",
    dateOrdered: "March 15, 2026",
    dueDate: "June 10, 2026",
    dueDateColor: "#5a4a00",
    priority: "Medium",
    priorityColor: "#8b7a2a",
    details: {
      Size: "Standard Shadow Box (25mm depth): Ideal for flat memorabilia like photos and certificates.",
      Color: "Natural Wood Finish: Warm brown tones showcasing the natural grain of the wood.",
    },
    totalStages: 4,
    stages: [
      { stage: "Carpenter", worker: "Juan dela Cruz", startDate: "03/20/26", dueDate: "04/10/26", status: "approved" },
    ],
  },
  {
    id: "DR-0022",
    name: "FRONT DOOR",
    displayName: "Front Door",
    dateOrdered: "February 20, 2026",
    dueDate: "May 30, 2026",
    dueDateColor: "#cc3300",
    priority: "High",
    priorityColor: "#cc3300",
    details: {
      Size: "Standard Door (80x200cm): Classic residential front door dimensions.",
      Color: "Dark Walnut Stain: Rich, deep brown finish with visible grain texture.",
    },
    totalStages: 5,
    stages: [
      { stage: "Carpenter", worker: "Carlo Cruz", startDate: "03/1/26", dueDate: "03/25/26", status: "approved" },
      { stage: "Carver", worker: "Maria Santos", startDate: "03/26/26", dueDate: "04/20/26", status: "pending" },
    ],
  },
];

export default function ProjectVerification() {
  const [selectedProject, setSelectedProject] = useState(null);
  const [stageStatuses, setStageStatuses] = useState({});

  const handleApprove = (projId, stageIdx) => {
    setStageStatuses((prev) => ({ ...prev, [`${projId}-${stageIdx}`]: "approved" }));
  };
  const handleRepair = (projId, stageIdx) => {
    setStageStatuses((prev) => ({ ...prev, [`${projId}-${stageIdx}`]: "repair" }));
  };

  const getStatus = (projId, stageIdx, defaultStatus) =>
    stageStatuses[`${projId}-${stageIdx}`] || defaultStatus;

  const approvedCount = (proj) =>
    proj.stages.filter((s, i) => getStatus(proj.id, i, s.status) === "approved").length;

  if (selectedProject) {
    const proj = selectedProject;
    const approved = approvedCount(proj);
    const progressPct = Math.round((approved / proj.totalStages) * 100);

    return (
      <div className="pv-container">
        <div className="pv-detail-card">
          <div className="pv-detail-left">
            <div className="pv-detail-id">{proj.id}</div>
            <div className="pv-detail-name">{proj.displayName}</div>

            {[
              { label: "Date Ordered", value: proj.dateOrdered, color: "#3a2e00" },
              { label: "Due Date", value: proj.dueDate, color: proj.dueDateColor },
              { label: "Priority", value: proj.priority, color: proj.priorityColor },
            ].map(({ label, value, color }) => (
              <div key={label} className="pv-info-box">
                <div className="pv-info-label">{label}</div>
                <div className="pv-info-value" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>

          <div className="pv-detail-right">
            <div className="pv-details-title">PROJECT DETAILS</div>
            {Object.entries(proj.details).map(([key, val]) => (
              <div key={key} className="pv-detail-item">
                <div className="pv-detail-item-title">{key}</div>
                <div className="pv-detail-item-desc">{val}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="pv-progress-card">
          <div className="pv-progress-header">
            <span className="pv-progress-title">Project Progress</span>
            <div className="pv-progress-bar-container">
              <div className="pv-progress-bar">
                <div className="pv-progress-bar-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="pv-progress-count">{approved}/{proj.totalStages}</span>
            </div>
          </div>

          <table className="pv-table">
            <thead>
              <tr>
                {["STAGE", "WORKER", "START DATE", "DUE DATE", "STATUS"].map((col) => (
                  <th key={col} className={col === "STATUS" ? "pv-table-status" : ""}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(6)].map((_, i) => {
                const s = proj.stages[i];
                if (!s) return (
                  <tr key={i}>
                    <td colSpan={5}></td>
                  </tr>
                );
                const status = getStatus(proj.id, i, s.status);
                return (
                  <tr key={i}>
                    <td className="pv-table-stage">{s.stage}</td>
                    <td>{s.worker}</td>
                    <td>{s.startDate}</td>
                    <td>{s.dueDate}</td>
                    <td className="pv-table-status-cell">
                      {status === "approved" ? (
                        <span className="pv-status-approved">Approved</span>
                      ) : status === "repair" ? (
                        <span className="pv-status-repair">For Repair</span>
                      ) : (
                        <div className="pv-action-buttons">
                          <button onClick={() => handleApprove(proj.id, i)} className="pv-btn-approve">✓ Approve</button>
                          <button onClick={() => handleRepair(proj.id, i)} className="pv-btn-repair">✕ Repair</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div>
          <button onClick={() => setSelectedProject(null)} className="pv-back-button">← Back to Project List</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pv-container">
      <h1 className="pv-list-header">PROJECT LIST</h1>
      <p className="pv-list-subtitle">Click project to verify</p>
      <div className="pv-list-divider" />

      <div className="pv-list-container">
        {projects.map((project, idx) => {
          return (
            <div
              key={project.id}
              onClick={() => setSelectedProject(project)}
              className="pv-list-item"
            >
              <span className="pv-list-item-id">{project.id}</span>
              <span className="pv-list-item-name">{project.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}