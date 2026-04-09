import { useState } from "react";
import "../../css/account.css";

const EMPLOYEE_OPTIONS = [
  "Juan dela Cruz",
  "Maria Santos",
  "Pedro Reyes",
  "Carlo Cruz",
  "Jose Ramirez",
  "Antonio Garcia",
  "Miguel Fernandez",
];

export function FormInput({ label, type = "text", placeholder = "", value, onChange }) {
  return (
    <div className="input-group">
      <label>{label}</label>
      <input 
        type={type} 
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

export function FormSelect({ label, options, value, onChange }) {
  return (
    <div className="input-group">
      <label>{label}</label>
      <div className="select-wrapper">
        <select value={value} onChange={onChange}>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function ActionButtons({ onCancel, onSubmit }) {
  return (
    <div className="form-actions">
      <button type="button" className="form-btn cancel" onClick={onCancel}>Cancel</button>
      <button type="button" className="form-btn" onClick={onSubmit}>Create Account</button>
    </div>
  );
}

export function AccountForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    password: "",
    role: "Admin"
  });

  const ROLE_OPTIONS = [
    "Admin",
    "Worker",
    "Production Manager",
    "Inventory",
    "Quality Checker",
  ];

  const handleChange = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit(formData);
    }
  };

  return (
    <div className="form-card">
      <div className="form-grid">
        <FormSelect 
          label="Selected Employees" 
          options={EMPLOYEE_OPTIONS}
          value={formData.fullName}
          onChange={handleChange("fullName")}
        />
        <FormInput 
          label="Username" 
          placeholder="Enter Username"
          value={formData.username}
          onChange={handleChange("username")}
        />
        <FormInput 
          label="Password" 
          type="password" 
          placeholder="Enter Password"
          value={formData.password}
          onChange={handleChange("password")}
        />
        <FormSelect 
          label="Role" 
          options={ROLE_OPTIONS}
          value={formData.role}
          onChange={handleChange("role")}
        />
      </div>
      <ActionButtons onCancel={onCancel} onSubmit={handleSubmit} />
    </div>
  );
}