import { useState } from "react";

const defaultBreakdown = [
  { item: "Juan dela Cruz – Wages", amount: 9000 },
  { item: "Maria Santos – Wages", amount: 9000 },
  { item: "Mahogany Wood (40 bd-ft)", amount: 3400 },
  { item: "Varnish (3L)", amount: 750 },
  { item: "Screws, Glue, Hardware", amount: 850 },
  { item: "Transport / Delivery", amount: 2000 },
];

function SpinnerInput({ value, onChange }) {
  return (
    <div style={{
      display: "flex", alignItems: "center",
      border: "1.5px solid #8b7a2a", borderRadius: 8,
      background: "#fff", overflow: "hidden"
    }}>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value) || 0)}
        style={{
          flex: 1, border: "none", outline: "none",
          padding: "12px 16px", fontSize: 15,
          fontFamily: "inherit", color: "#3a2e00",
          background: "transparent"
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", borderLeft: "1px solid #c8b840" }}>
        <button onClick={() => onChange(value + 500)} style={{ border: "none", background: "transparent", cursor: "pointer", padding: "4px 10px", fontSize: 11, color: "#5a4a00", lineHeight: 1 }}>▲</button>
        <button onClick={() => onChange(Math.max(0, value - 500))} style={{ border: "none", background: "transparent", cursor: "pointer", padding: "4px 10px", fontSize: 11, color: "#5a4a00", lineHeight: 1, borderTop: "1px solid #e8d98a" }}>▼</button>
      </div>
    </div>
  );
}

export default function Profit() {
  const [clientPayment, setClientPayment] = useState(85000);
  const [workerWages, setWorkerWages] = useState(18000);
  const [materialsCost, setMaterialsCost] = useState(22500);
  const [otherExpenses, setOtherExpenses] = useState(2000);
  const [breakdown] = useState(defaultBreakdown);

  const totalExpenses = workerWages + materialsCost + otherExpenses;
  const netProfit = clientPayment - totalExpenses;

  const fmt = (n) => "₱" + Number(n).toLocaleString("en-PH");

  return (
    <div style={{
      fontFamily: "'Georgia', serif",
      flex: 1, padding: "32px 40px",
      backgroundColor: "#ffffff",
      minHeight: "100vh", boxSizing: "border-box",
      display: "flex", alignItems: "flex-start", justifyContent: "center"
    }}>
      <div style={{
        border: "1.5px solid #8b7a2a", borderRadius: 14,
        padding: "32px 36px", background: "#fdf8ee",
        width: "100%", maxWidth: 740,
        boxShadow: "0 4px 20px rgba(100,80,0,0.08)"
      }}>
        {/* Title */}
        <h2 style={{ margin: "0 0 24px", fontSize: 22, fontWeight: "bold", color: "#3a2e00", fontFamily: "inherit" }}>
          Profit Detail — Rustic Frame
        </h2>

        {/* Input Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 24px", marginBottom: 24 }}>
          {[
            { label: "Client Payment (₱)", value: clientPayment, setter: setClientPayment },
            { label: "Worker Wages (₱)", value: workerWages, setter: setWorkerWages },
            { label: "Materials Cost (₱)", value: materialsCost, setter: setMaterialsCost },
            { label: "Other Expenses (₱)", value: otherExpenses, setter: setOtherExpenses },
          ].map(({ label, value, setter }) => (
            <div key={label}>
              <label style={{ fontSize: 13, color: "#5a4a00", fontWeight: 600, display: "block", marginBottom: 6 }}>{label}</label>
              <SpinnerInput value={value} onChange={setter} />
            </div>
          ))}
        </div>

        {/* Summary Box */}
        <div style={{ background: "#f0ead8", border: "1px solid #d4c47a", borderRadius: 8, padding: "16px 20px", marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 15, fontWeight: "bold", color: "#3a2e00" }}>Total Expenses</span>
            <span style={{ fontSize: 15, fontWeight: "bold", color: "#3a2e00" }}>{fmt(totalExpenses)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 18, fontWeight: "900", color: "#2a7a2a" }}>Net Profit</span>
            <span style={{ fontSize: 22, fontWeight: "900", color: "#2a7a2a" }}>{fmt(netProfit)}</span>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 14, color: "#6a5a20", fontWeight: 600, marginBottom: 12 }}>Expense Breakdown</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Expense Item", "Amount"].map(col => (
                  <th key={col} style={{ padding: "8px 12px", textAlign: "left", fontSize: 12, fontWeight: "800", color: "#5a4a00", letterSpacing: 1, borderBottom: "1.5px solid #c8b840", textTransform: "uppercase" }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {breakdown.map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #e8d98a" }}>
                  <td style={{ padding: "13px 12px", fontSize: 14, color: "#3a2e00" }}>{row.item}</td>
                  <td style={{ padding: "13px 12px", fontSize: 14, color: "#3a2e00" }}>{fmt(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 14 }}>
          <button
            style={{ background: "#5a4a00", color: "#fff", border: "none", borderRadius: 8, padding: "12px 32px", fontSize: 15, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
            onMouseOver={e => e.currentTarget.style.background = "#3a2e00"}
            onMouseOut={e => e.currentTarget.style.background = "#5a4a00"}
          >Cancel</button>
          <button
            style={{ background: "#3a2e00", color: "#fff", border: "none", borderRadius: 8, padding: "12px 32px", fontSize: 15, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
            onMouseOver={e => e.currentTarget.style.background = "#5a4a00"}
            onMouseOut={e => e.currentTarget.style.background = "#3a2e00"}
          >Save Changes</button>
        </div>
      </div>
    </div>
  );
}
