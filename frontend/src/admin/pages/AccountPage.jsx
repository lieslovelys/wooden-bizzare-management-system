import { useState } from "react";
import { AccountForm } from "../components/AccountForm";
import { AccountList } from "../components/AccountList";
import "../../css/account.css";

const INITIAL_ACCOUNTS = [
  { id: "#001", name: "Juan dela Cruz", role: "Worker", username: "Juan.dc" },
  { id: "#002", name: "Ana Reyes", role: "Quality Checker", username: "ana.r" },
];

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState("creation");
  const [accounts, setAccounts] = useState(INITIAL_ACCOUNTS);

  const handleDelete = (id) => {
    setAccounts((prev) => prev.filter((acc) => acc.id !== id));
  };

  const handleSubmit = (formData) => {
    const newAccount = {
      id: `#${String(accounts.length + 1).padStart(3, "0")}`,
      name: formData.fullName || "New User",
      role: formData.role || "Worker",
      username: formData.username || "new.user",
    };
    setAccounts((prev) => [...prev, newAccount]);
    setActiveTab("list");
  };

  const handleCancel = () => {
    setActiveTab("list");
  };

  return (
    <div className="account-creation">
      <div className="tab-container">
        <button
          className={`tab-btn ${activeTab === "creation" ? "active" : ""}`}
          onClick={() => setActiveTab("creation")}
        >
          Account Creation
        </button>
        <button
          className={`tab-btn ${activeTab === "list" ? "active" : ""}`}
          onClick={() => setActiveTab("list")}
        >
          Account List
        </button>
      </div>

      {activeTab === "creation" ? (
        <div className="tab-content active">
          <AccountForm onSubmit={handleSubmit} onCancel={handleCancel} />
        </div>
      ) : (
        <div className="tab-content active">
          <AccountList accounts={accounts} onDelete={handleDelete} />
        </div>
      )}
    </div>
  );
}