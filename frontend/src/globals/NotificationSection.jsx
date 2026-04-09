import React, { useState } from 'react';

const NotificationSection = ({ initialNotifications = [], title = "Notifications" }) => {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [readIds, setReadIds] = useState([]);

  const defaultNotifications = [
    { id: 1, title: "To verify", description: "Worker submit a project" },
    { id: 2, title: "Monthly Profit", description: "April, 2026 profit is here" },
    { id: 3, title: "To verify", description: "Worker submit a project" },
    { id: 4, title: "To verify", description: "Worker submit a project" },
  ];

  const notificationList = notifications.length > 0 ? notifications : defaultNotifications;

  const deleteOne = (id) => setNotifications((prev) => prev.filter((n) => n.id !== id));
  const clearAll = () => setNotifications([]);
  const markAllRead = () => setReadIds(notificationList.map((n) => n.id));

  const isRead = (id) => readIds.includes(id);

  return (
    <div className="notification-section">
      <div className="notification-header">
        <span className="notification-icon">🔔</span>
        <h1 className="notification-title">{title}</h1>
      </div>

      <div className="notification-list">
        {notificationList.length === 0 && (
          <div className="notification-empty">No notifications.</div>
        )}
        {notificationList.map((n) => (
          <div key={n.id} className={`notification-item ${isRead(n.id) ? 'notification-item-read' : ''}`}>
            <div className="notification-accent"></div>
            <div className="notification-content">
              <div className="notification-item-title">{n.title}</div>
              <div className="notification-item-desc">{n.description}</div>
            </div>
            <button onClick={() => deleteOne(n.id)} className="notification-delete-btn">🗑</button>
          </div>
        ))}
      </div>

      <div className="notification-actions">
        <button onClick={clearAll} className="notification-btn">Clear All</button>
        <button onClick={markAllRead} className="notification-btn">Mark All as Read</button>
      </div>
    </div>
  );
};

export default NotificationSection;