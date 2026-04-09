import React, { useState } from 'react';

const WorkerJobOrderSystem = () => {
  const [currentView, setCurrentView] = useState('list');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [hoveredOrder, setHoveredOrder] = useState(null);

  const jobOrders = [
    { id: 'FR-0038', title: 'LUXURY FRAME' },
    { id: 'FR-0088', title: 'STRANDED FRAME' },
    { id: 'DR-0022', title: 'FRONT DOOR' },
  ];

  const getBackground = (orderId) => {
    if (selectedOrder === orderId) return "#b8a030";
    if (hoveredOrder === orderId) return "rgba(184, 160, 48, 0.15)";
    return "#fff";
  };

  const getColor = (orderId) => {
    if (selectedOrder === orderId) return "#fff";
    return "#5a4a00";
  };

  const JobOrderList = () => (
    <div style={{ padding: 48, width: "100%", maxWidth: "90%", margin: "0 auto" }}>
      <h1 style={{ fontSize: 30, fontWeight: "bold", color: "#5a4a00", marginBottom: 4, fontFamily: "'Georgia', serif" }}>JOB ORDER LIST</h1>
      <p style={{ color: "#8b7a2a", fontWeight: "600", marginBottom: 16, fontFamily: "'Georgia', serif" }}>Click order to view</p>
      <div style={{ height: 6, background: "linear-gradient(to right, #b8a040, #d4c47a, #c8b060)", borderRadius: 3, marginBottom: 40 }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {jobOrders.map((order) => (
          <div
            key={order.id}
            onClick={() => { setSelectedOrder(order.id); setCurrentView('details'); }}
            onMouseEnter={() => setHoveredOrder(order.id)}
            onMouseLeave={() => setHoveredOrder(null)}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "16px 24px",
              borderRadius: 8,
              cursor: "pointer",
              transition: "background 0.15s",
              background: getBackground(order.id),
              color: getColor(order.id),
              fontFamily: "'Georgia', serif"
            }}
          >
            <span style={{ fontSize: 20, fontWeight: "bold", width: 130 }}>{order.id}</span>
            <span style={{ fontSize: 20, fontWeight: "bold", textTransform: "uppercase" }}>{order.title}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const JobOrderDetails = () => (
    <div style={{ padding: 32, width: "100%", maxWidth: "90%", margin: "0 auto" }}>
      <div style={{ border: "1.5px solid #8b7a2a", borderRadius: 16, padding: 24, background: "#fff", display: "flex", gap: 32, marginBottom: 24 }}>
        <div style={{ width: "33%" }}>
          <div>
            <h2 style={{ color: "#5a4a00", fontSize: 30, fontWeight: "bold", fontFamily: "'Georgia', serif" }}>FR-0038</h2>
            <p style={{ color: "#8b7a2a", fontSize: 18, fontWeight: "bold", fontFamily: "'Georgia', serif" }}>Luxury Frame</p>
          </div>
          
          <div style={{ background: "#d6d0c4", borderRadius: 8, padding: "10px 14px", marginTop: 12 }}>
            <p style={{ fontSize: 12, color: "#5a4a00", fontWeight: "600", fontFamily: "'Georgia', serif" }}>Date Ordered</p>
            <p style={{ fontWeight: "bold", color: "#3a2e00", fontFamily: "'Georgia', serif" }}>April 1, 2026</p>
          </div>
          
          <div style={{ background: "#d6d0c4", borderRadius: 8, padding: "10px 14px", marginTop: 10, borderLeft: "4px solid #cc3300" }}>
            <p style={{ fontSize: 12, color: "#5a4a00", fontWeight: "600", fontFamily: "'Georgia', serif" }}>Due Date</p>
            <p style={{ fontWeight: "bold", color: "#cc3300", fontFamily: "'Georgia', serif" }}>May 25, 2026</p>
          </div>

          <div style={{ background: "#d6d0c4", borderRadius: 8, padding: "10px 14px", marginTop: 10, borderLeft: "4px solid #cc7700" }}>
            <p style={{ fontSize: 12, color: "#5a4a00", fontWeight: "600", fontFamily: "'Georgia', serif" }}>Priority</p>
            <p style={{ fontWeight: "bold", color: "#cc7700", fontFamily: "'Georgia', serif" }}>High</p>
          </div>
        </div>

        <div style={{ width: "67%", background: "#c8c4b8", borderRadius: 12, padding: 20, position: "relative" }}>
            <p style={{ color: "#5a4a00", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginBottom: 12, textTransform: "uppercase", fontFamily: "'Georgia', serif" }}>Project Details</p>
            <div style={{ maxHeight: 280, overflowY: "auto", paddingRight: 16 }}>
                <div style={{ background: "#b8b4a8", borderRadius: 8, padding: "12px 16px", marginBottom: 12 }}>
                    <p style={{ fontWeight: "bold", color: "#3a2e00", fontSize: 14, fontFamily: "'Georgia', serif" }}>Size</p>
                    <p style={{ fontSize: 13, color: "#3a2e00", lineHeight: 1.5, fontFamily: "'Georgia', serif" }}>Deep Shadow Boxes (50mm+ depth): Used for 3D memorabilia or to create a 3D float effect, enhancing the depth and presence of an object.</p>
                </div>
                <div style={{ background: "#b8b4a8", borderRadius: 8, padding: "12px 16px" }}>
                    <p style={{ fontWeight: "bold", color: "#3a2e00", fontSize: 14, fontFamily: "'Georgia', serif" }}>Color</p>
                    <p style={{ fontSize: 13, color: "#3a2e00", lineHeight: 1.5, fontFamily: "'Georgia', serif" }}>Brushed Gold & Warm Metallics (Champagne/Brass): The defining metal finish, offering a muted, sophisticated glow rather than bright yellow gold.</p>
                </div>
            </div>
        </div>
      </div>

      <div style={{ border: "1.5px solid #8b7a2a", borderRadius: 24, overflow: "hidden", background: "#fff", marginBottom: 24 }}>
        <div style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1.5px solid #e8d98a" }}>
          <h3 style={{ color: "#5a4a00", fontWeight: "bold", fontSize: 20, fontStyle: "italic", fontFamily: "'Georgia', serif" }}>Project Progress</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
             <div style={{ width: 192, height: 16, background: "#f5e6b0", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ width: "33%", height: "100%", background: "linear-gradient(to right, #b8a030, #d4c060)", borderRadius: 8 }}></div>
             </div>
             <span style={{ color: "#5a4a00", fontWeight: "bold", fontFamily: "'Georgia', serif" }}>1/6</span>
          </div>
        </div>

        <table style={{ width: "100%", textAlign: "center", borderCollapse: "collapse" }}>
          <thead style={{ borderBottom: "1.5px solid #e8d98a" }}>
            <tr style={{ color: "#5a4a00", fontWeight: "bold" }}>
              <th style={{ padding: 16, borderRight: "1px solid #e8d98a", fontFamily: "'Georgia', serif" }}>STAGE</th>
              <th style={{ padding: 16, borderRight: "1px solid #e8d98a", fontFamily: "'Georgia', serif" }}>WORKER</th>
              <th style={{ padding: 16, borderRight: "1px solid #e8d98a", fontFamily: "'Georgia', serif" }}>START DATE</th>
              <th style={{ padding: 16, borderRight: "1px solid #e8d98a", fontFamily: "'Georgia', serif" }}>DUE DATE</th>
              <th style={{ padding: 16, fontFamily: "'Georgia', serif" }}>STATUS</th>
            </tr>
          </thead>
          <tbody style={{ fontSize: 14, fontWeight: "bold", color: "#8b7a2a" }}>
            <tr style={{ borderBottom: "1px solid #e8d98a" }}>
              <td style={{ padding: 16, borderRight: "1px solid #e8d98a", color: "#5a4a00", fontSize: 18 }}>Carpenter</td>
              <td style={{ padding: 16, borderRight: "1px solid #e8d98a", fontFamily: "'Georgia', serif" }}>John Kenneth Juralbal</td>
              <td style={{ padding: 16, borderRight: "1px solid #e8d98a", fontFamily: "'Georgia', serif" }}>04/5/26</td>
              <td style={{ padding: 16, borderRight: "1px solid #e8d98a", fontFamily: "'Georgia', serif" }}>04/23/26</td>
              <td style={{ padding: 16 }}><span style={{ background: "#4a8a4a", color: "#fff", padding: "6px 16px", borderRadius: 20, fontSize: 12 }}>Done</span></td>
            </tr>
            <tr style={{ borderBottom: "1px solid #e8d98a" }}>
              <td style={{ padding: 16, borderRight: "1px solid #e8d98a", color: "#5a4a00", fontSize: 18 }}>Carver</td>
              <td style={{ padding: 16, borderRight: "1px solid #e8d98a", fontFamily: "'Georgia', serif" }}>Laurence Orot</td>
              <td style={{ padding: 16, borderRight: "1px solid #e8d98a", fontFamily: "'Georgia', serif" }}>04/25/26</td>
              <td style={{ padding: 16, borderRight: "1px solid #e8d98a", fontFamily: "'Georgia', serif" }}>05/15/26</td>
              <td style={{ padding: 16 }}><span style={{ background: "#5a7aba", color: "#fff", padding: "6px 12px", borderRadius: 20, fontSize: 12 }}>In progress</span></td>
            </tr>
            {[1, 2].map((i) => (
               <tr key={i} style={{ borderBottom: "1px solid #e8d98a", height: 48 }}>
                 <td style={{ borderRight: "1px solid #e8d98a" }}></td>
                 <td style={{ borderRight: "1px solid #e8d98a" }}></td>
                 <td style={{ borderRight: "1px solid #e8d98a" }}></td>
                 <td style={{ borderRight: "1px solid #e8d98a" }}></td>
                 <td></td>
               </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isSubmitted ? (
        <button 
          onClick={() => setIsSubmitted(true)}
          style={{ width: "100%", background: "#005c00", color: "#fff", fontWeight: "900", fontSize: 24, padding: "12px 0", borderRadius: 16, cursor: "pointer", fontFamily: "'Georgia', serif", border: "none" }}
        >
          I AM DONE
        </button>
      ) : (
        <button 
          onClick={() => {setIsSubmitted(false); setCurrentView('list');}}
          style={{ width: "100%", background: "#6b8e6b", color: "#003300", fontWeight: "900", fontSize: 24, padding: "12px 0", borderRadius: 16, cursor: "default", fontFamily: "'Georgia', serif", border: "none" }}
        >
          WORK SUBMITTED
        </button>
      )}
    </div>
  );

  return (
    <div style={{ flex: 1, minHeight: "100vh", background: "#fff", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
      {currentView === 'list' ? <JobOrderList /> : <JobOrderDetails />}
    </div>
  );
};

export default WorkerJobOrderSystem;