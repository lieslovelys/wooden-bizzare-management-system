import React, { useState } from 'react';

const QualityCheckerDashboard = () => {
  const [notifications, setNotifications] = useState([
    { title: "New Project Arrived", description: "See Project Verification to view project" },
    { title: "To verify", description: "Worker submit a project" },
    { title: "To verify", description: "Worker submit a project" },
    { title: "To verify", description: "Worker submit a project" },
  ]);
  const [readIds, setReadIds] = useState([]);

  const deleteOne = (index) => {
    setNotifications(notifications.filter((_, i) => i !== index));
  };

  const clearAll = () => setNotifications([]);
  const markAllRead = () => setReadIds(notifications.map((_, i) => i));

  const isRead = (index) => readIds.includes(index);

  return (
    <div style={{ flex: 1, minHeight: "100vh", background: "#fff", padding: 40, fontFamily: "'Georgia', serif" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 64 }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center", background: "#fdf8ee", borderRadius: 16, width: 350, height: 180, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 24, background: "#cc3300", borderRadius: "16px 0 0 16px" }}></div>
          
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", marginLeft: 24 }}>
            <h2 style={{ color: "#5a4a00", fontSize: 24, fontWeight: "bold", marginBottom: 16, letterSpacing: 1 }}>TO VERIFY</h2>
            <span style={{ fontSize: 60, fontWeight: "900", color: "#000" }}>1</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "100%", margin: "0 auto" }}>
        <div style={{ height: 6, background: "linear-gradient(to right, #b8a040, #d4c47a, #c8b060)", borderRadius: 3, marginBottom: 32 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
          <span style={{ fontSize: 28, color: "#5a4a00" }}>🔔</span>
          <h2 style={{ color: "#5a4a00", fontSize: 24, fontWeight: "bold" }}>Notifications</h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 40, width: "100%" }}>
          {notifications.map((notif, index) => (
            <div 
              key={index} 
              style={{
                display: "flex",
                alignItems: "center",
                background: isRead(index) ? "#fff" : "#c29236",
                border: "1.5px solid #8b7a2a",
                borderRadius: 6,
                overflow: "hidden",
                padding: "16px 20px",
                minHeight: 80
              }}
            >
              <div style={{ width: 12, background: "#4b3b1a", alignSelf: "stretch" }}></div>
              
              <div style={{ flex: 1, padding: "12px 20px" }}>
                <h4 style={{ fontWeight: "bold", fontSize: 18, lineHeight: 1.2, color: isRead(index) ? "#3a2e00" : "#fff" }}>{notif.title}</h4>
                <p style={{ fontSize: 14, fontWeight: "500", color: isRead(index) ? "#5a4a00" : "rgba(255,255,255,0.9)" }}>
                  {notif.description.includes('Project Verification') ? (
                    <>See <span style={{ fontWeight: "bold", textDecoration: "underline" }}>Project Verification</span> to view project</>
                  ) : (
                    notif.description
                  )}
                </p>
              </div>
              
              <button 
                onClick={() => deleteOne(index)}
                style={{ 
                  padding: "0 24px", 
                  background: "transparent", 
                  border: "none", 
                  cursor: "pointer",
                  color: isRead(index) ? "#8b7a2a" : "#fff",
                  fontSize: 28
                }}
              >
                🗑
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 16 }}>
          <button 
            onClick={clearAll}
            style={{ background: "#4b3b1a", color: "#fff", padding: "10px 32px", borderRadius: 24, fontWeight: "bold", fontSize: 14, cursor: "pointer", border: "none", fontFamily: "'Georgia', serif" }}
          >
            Clear All
          </button>
          <button 
            onClick={markAllRead}
            style={{ background: "#4b3b1a", color: "#fff", padding: "10px 32px", borderRadius: 24, fontWeight: "bold", fontSize: 14, cursor: "pointer", border: "none", fontFamily: "'Georgia', serif" }}
          >
            Mark All as Read
          </button>
        </div>
      </div>
    </div>
  );
};

export default QualityCheckerDashboard;