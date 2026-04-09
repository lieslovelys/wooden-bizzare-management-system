import { useState } from "react";

const initialNotifications = [
  {
    id: 1,
    title: "New Project Arrived",
    message: (
      <>See <strong>Project Verification</strong> to view project</>
    ),
    messagePlain: "See Project Verification to view project",
  },
  { id: 2, title: "To verify", message: "Worker submit a project", messagePlain: "Worker submit a project" },
  { id: 3, title: "To verify", message: "Worker submit a project", messagePlain: "Worker submit a project" },
  { id: 4, title: "To verify", message: "Worker submit a project", messagePlain: "Worker submit a project" },
];

export default function Notification() {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [readIds, setReadIds] = useState([]);

  const deleteOne = (id) => setNotifications((prev) => prev.filter((n) => n.id !== id));
  const clearAll = () => setNotifications([]);
  const markAllRead = () => setReadIds(notifications.map(n => n.id));

  const isRead = (id) => readIds.includes(id);

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
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <span style={{ fontSize: 26, color: "#5a4a00", fontFamily: "'Georgia', serif" }}>🔔</span>
        <h1 style={{
          margin: 0, fontSize: 28, fontWeight: "900",
          color: "#5a4a00", fontFamily: "'Georgia', serif",
        }}>
          Notifications
        </h1>
      </div>

      {/* Notification Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
        {notifications.length === 0 && (
          <div style={{ fontSize: 15, color: "#8b7a2a", padding: "20px 0", fontFamily: "'Georgia', serif" }}>No notifications.</div>
        )}
        {notifications.map((n) => (
          <div
            key={n.id}
            style={{
              background: isRead(n.id) ? "#ffffff" : "#a08020",
              border: "1.5px solid #8b7a2a",
              borderRadius: 6,
              padding: "14px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div>
              <div style={{ 
                fontWeight: "900", 
                fontSize: 15, 
                color: isRead(n.id) ? "#3a2e00" : "#fff", 
                marginBottom: 3,
                fontFamily: "'Georgia', serif"
              }}>
                {n.title}
              </div>
              <div style={{ 
                fontSize: 14, 
                color: isRead(n.id) ? "#5a4a00" : "#f0e8c8",
                fontFamily: "'Georgia', serif"
              }}>
                {n.message}
              </div>
            </div>
            {/* Delete icon */}
            <button
              onClick={() => deleteOne(n.id)}
              title="Delete"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: isRead(n.id) ? "#8b7a2a" : "#fff",
                fontSize: 18,
                flexShrink: 0,
                padding: "4px 6px",
                opacity: 0.85,
                transition: "opacity 0.15s",
                fontFamily: "'Georgia', serif"
              }}
              onMouseOver={e => e.currentTarget.style.opacity = 1}
              onMouseOut={e => e.currentTarget.style.opacity = 0.85}
            >
              🗑
            </button>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 14 }}>
        <button
          onClick={clearAll}
          style={{
            background: "#5a4a00", color: "#fff",
            border: "none", borderRadius: 8,
            padding: "12px 28px", fontSize: 15,
            cursor: "pointer", fontFamily: "'Georgia', serif", fontWeight: "700",
            transition: "background 0.18s",
          }}
          onMouseOver={e => e.currentTarget.style.background = "#3a2e00"}
          onMouseOut={e => e.currentTarget.style.background = "#5a4a00"}
        >
          Clear All
        </button>
        <button
          onClick={markAllRead}
          style={{
            background: "#3a2e00", color: "#fff",
            border: "none", borderRadius: 8,
            padding: "12px 28px", fontSize: 15,
            cursor: "pointer", fontFamily: "'Georgia', serif", fontWeight: "700",
            transition: "background 0.18s",
          }}
          onMouseOver={e => e.currentTarget.style.background = "#5a4a00"}
          onMouseOut={e => e.currentTarget.style.background = "#3a2e00"}
        >
          Mark All as Read
        </button>
      </div>
    </div>
  );
}
