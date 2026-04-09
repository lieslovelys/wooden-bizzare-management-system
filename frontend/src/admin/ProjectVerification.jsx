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

  // ── DETAIL VIEW ──────────────────────────────────────────────────────────────
  if (selectedProject) {
    const proj = selectedProject;
    const approved = approvedCount(proj);
    const progressPct = Math.round((approved / proj.totalStages) * 100);

    return (
      <div style={{ fontFamily: "'Georgia', serif", flex: 1, padding: "32px 40px", backgroundColor: "#ffffff", minHeight: "100vh", boxSizing: "border-box" }}>

        {/* Top Info Card */}
        <div style={{ border: "1.5px solid #c8b840", borderRadius: 14, padding: "24px 28px", background: "#fff", marginBottom: 32, display: "flex", gap: 28 }}>

          {/* Left: project meta */}
          <div style={{ minWidth: 210 }}>
            <div style={{ fontSize: 26, fontWeight: "900", color: "#5a4a00", marginBottom: 2 }}>{proj.id}</div>
            <div style={{ fontSize: 16, fontWeight: "700", color: "#8b7a2a", marginBottom: 18 }}>{proj.displayName}</div>

            {[
              { label: "Date Ordered", value: proj.dateOrdered, color: "#3a2e00" },
              { label: "Due Date", value: proj.dueDate, color: proj.dueDateColor },
              { label: "Priority", value: proj.priority, color: proj.priorityColor },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: "#d6d0c4", borderRadius: 8, padding: "10px 14px", marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "#5a4a00", fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: "bold", color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Right: scrollable details */}
          <div style={{ flex: 1, background: "#ddd8cc", borderRadius: 10, padding: "16px 20px", maxHeight: 230, overflowY: "auto" }}>
            <div style={{ fontSize: 11, fontWeight: "800", color: "#5a4a00", letterSpacing: 1.5, marginBottom: 16, textTransform: "uppercase" }}>PROJECT DETAILS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {Object.entries(proj.details).map(([key, val]) => (
              <div key={key} style={{ background: "#c8c4b8", borderRadius: 8, padding: "12px 16px" }}>
                <div style={{ fontSize: 13, fontWeight: "700", color: "#3a2e00", marginBottom: 4 }}>{key}</div>
                <div style={{ fontSize: 13, color: "#3a2e00", lineHeight: 1.5 }}>{val}</div>
              </div>
            ))}
            </div>
          </div>
        </div>

        {/* Progress Card */}
        <div style={{ border: "1.5px solid #c8b840", borderRadius: 14, padding: "24px 28px", background: "#fff" }}>

          {/* Progress header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <span style={{ fontSize: 18, fontWeight: "900", color: "#3a2e00" }}>Project Progress</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 200, height: 16, background: "#e8e0c8", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ width: `${progressPct}%`, height: "100%", background: "linear-gradient(to right, #b8a030, #d4c060)", borderRadius: 8, transition: "width 0.4s" }} />
              </div>
              <span style={{ fontSize: 15, fontWeight: "bold", color: "#5a4a00" }}>{approved}/{proj.totalStages}</span>
            </div>
          </div>

          {/* Stage table */}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["STAGE", "WORKER", "START DATE", "DUE DATE", "STATUS"].map((col) => (
                  <th key={col} style={{ padding: "10px 12px", textAlign: col === "STATUS" ? "center" : "left", fontSize: 13, fontWeight: "900", color: "#3a2e00", borderBottom: "2px solid #e8d98a", letterSpacing: 0.8 }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(6)].map((_, i) => {
                const s = proj.stages[i];
                if (!s) return (
                  <tr key={i} style={{ borderBottom: "1px solid #e8d98a" }}>
                    <td colSpan={5} style={{ padding: "18px 12px" }}>&nbsp;</td>
                  </tr>
                );
                const status = getStatus(proj.id, i, s.status);
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #e8d98a" }}>
                    <td style={{ padding: "14px 12px", fontSize: 15, fontWeight: "700", color: "#8b7a2a" }}>{s.stage}</td>
                    <td style={{ padding: "14px 12px", fontSize: 14, color: "#3a2e00" }}>{s.worker}</td>
                    <td style={{ padding: "14px 12px", fontSize: 14, color: "#3a2e00" }}>{s.startDate}</td>
                    <td style={{ padding: "14px 12px", fontSize: 14, color: "#3a2e00" }}>{s.dueDate}</td>
                    <td style={{ padding: "14px 12px", textAlign: "center" }}>
                      {status === "approved" ? (
                        <span style={{ background: "#4a8a4a", color: "#fff", borderRadius: 20, padding: "7px 28px", fontSize: 13, fontWeight: 600 }}>Approved</span>
                      ) : status === "repair" ? (
                        <span style={{ background: "#cc3300", color: "#fff", borderRadius: 20, padding: "7px 28px", fontSize: 13, fontWeight: 600 }}>For Repair</span>
                      ) : (
                        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                          <button onClick={() => handleApprove(proj.id, i)} style={{ background: "#4a8a4a", color: "#fff", border: "none", borderRadius: 20, padding: "7px 18px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>✓ Approve</button>
                          <button onClick={() => handleRepair(proj.id, i)} style={{ background: "#cc3300", color: "#fff", border: "none", borderRadius: 20, padding: "7px 18px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>✕ Repair</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 16 }}>
          <button onClick={() => setSelectedProject(null)} style={{ background: "transparent", border: "none", color: "#8b7a2a", fontSize: 14, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, padding: 0 }}>← Back to Project List</button>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Georgia', serif", flex: 1, padding: "32px 40px", backgroundColor: "#ffffff", minHeight: "100vh", boxSizing: "border-box" }}>
      <h1 style={{ margin: "0 0 6px", fontSize: 32, fontWeight: "900", color: "#5a4a00", letterSpacing: 1, textTransform: "uppercase" }}>PROJECT LIST</h1>
      <p style={{ margin: "0 0 14px", fontSize: 14, color: "#8b7a2a", fontWeight: 600 }}>Click project to verify</p>
      <div style={{ height: 6, background: "linear-gradient(to right, #b8a040, #d4c47a, #c8b060)", borderRadius: 3, marginBottom: 32 }} />

      <div style={{ display: "flex", flexDirection: "column" }}>
        {projects.map((project, idx) => {
          return (
            <div
              key={project.id}
              onClick={() => setSelectedProject(project)}
              style={{ display: "flex", alignItems: "center", gap: 24, padding: "16px 24px", background: "transparent", cursor: "pointer", borderRadius: 4, marginBottom: 12, transition: "background 0.15s" }}
              onMouseOver={e => { e.currentTarget.style.background = "rgba(184,160,48,0.15)"; }}
              onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontSize: 16, fontWeight: "900", color: "#5a4a00", minWidth: 90, letterSpacing: 0.5 }}>{project.id}</span>
              <span style={{ fontSize: 17, fontWeight: "900", color: "#3a2e00", letterSpacing: 1 }}>{project.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
