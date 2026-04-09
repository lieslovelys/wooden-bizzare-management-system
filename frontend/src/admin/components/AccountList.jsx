import "../../css/account.css";

const INITIAL_ACCOUNTS = [
  { id: "#001", name: "Juan dela Cruz", role: "Worker", username: "Juan.dc" },
  { id: "#002", name: "Ana Reyes", role: "Quality Checker", username: "ana.r" },
];

const EMPTY_ROWS = 3;

export function AccountRow({ account, onDelete }) {
  return (
    <tr>
      <td>{account.id}</td>
      <td>{account.name}</td>
      <td>{account.role}</td>
      <td>{account.username}</td>
      <td>
        <button className="btn-delete" onClick={() => onDelete(account.id)}>
          Delete
        </button>
      </td>
    </tr>
  );
}

export function EmptyRow() {
  return (
    <tr className="table-empty-row">
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
  );
}

export function AccountList({ accounts, onDelete }) {
  return (
    <div className="table-container">
      <table className="account-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Full Name</th>
            <th>Role</th>
            <th>Username</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((acc) => (
            <AccountRow key={acc.id} account={acc} onDelete={onDelete} />
          ))}
          {Array.from({ length: EMPTY_ROWS }).map((_, i) => (
            <EmptyRow key={`empty-${i}`} />
          ))}
        </tbody>
      </table>
    </div>
  );
}