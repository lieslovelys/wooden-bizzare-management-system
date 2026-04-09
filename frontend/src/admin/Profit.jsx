import { useState } from "react";
import "../css/admin.css";

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
    <div className="profit-spinner">
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value) || 0)}
      />
      <div className="profit-spinner-buttons">
        <button onClick={() => onChange(value + 500)}>▲</button>
        <button onClick={() => onChange(Math.max(0, value - 500))}>▼</button>
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
    <div className="profit-container">
      <div className="profit-card">
        {/* Title */}
        <h2 className="profit-title">
          Profit Detail — Rustic Frame
        </h2>

        {/* Input Grid */}
        <div className="profit-input-grid">
          {[
            { label: "Client Payment (₱)", value: clientPayment, setter: setClientPayment },
            { label: "Worker Wages (₱)", value: workerWages, setter: setWorkerWages },
            { label: "Materials Cost (₱)", value: materialsCost, setter: setMaterialsCost },
            { label: "Other Expenses (₱)", value: otherExpenses, setter: setOtherExpenses },
          ].map(({ label, value, setter }) => (
            <div key={label}>
              <label className="profit-input-label">{label}</label>
              <SpinnerInput value={value} onChange={setter} />
            </div>
          ))}
        </div>

        {/* Summary Box */}
        <div className="profit-summary">
          <div className="profit-summary-row">
            <span className="profit-summary-label">Total Expenses</span>
            <span className="profit-summary-value">{fmt(totalExpenses)}</span>
          </div>
          <div className="profit-summary-row">
            <span className="profit-net-label">Net Profit</span>
            <span className="profit-net-value">{fmt(netProfit)}</span>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div style={{ marginBottom: 28 }}>
          <div className="profit-breakdown-title">Expense Breakdown</div>
          <table className="profit-table">
            <thead>
              <tr>
                {["Expense Item", "Amount"].map(col => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {breakdown.map((row, i) => (
                <tr key={i}>
                  <td>{row.item}</td>
                  <td>{fmt(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Buttons */}
        <div className="profit-buttons">
          <button className="profit-btn profit-btn-cancel">Cancel</button>
          <button className="profit-btn profit-btn-save">Save Changes</button>
        </div>
      </div>
    </div>
  );
}
