import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // IDINAGDAG: Para makalipat ng page
import '../css/admin.css';

const AdminNotification = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // IDINAGDAG: Initialize ang navigate function
  const navigate = useNavigate();

  // FETCH: Kunin ang data sa database pagka-load ng page
  const fetchNotifications = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/notifications'); // I-adjust kung iba ang port/URL mo
      const data = await response.json();
      setNotifications(data);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // DELETE ONE
  const handleDelete = async (id) => {
    try {
      await fetch(`http://localhost:8080/api/notifications/${id}`, { method: 'DELETE' });
      setNotifications(notifications.filter(notif => notif.id !== id));
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  // CLEAR ALL
  const handleClearAll = async () => {
    if(window.confirm("Are you sure you want to clear all notifications?")) {
      try {
        await fetch('http://localhost:8080/api/notifications/clear/all', { method: 'DELETE' });
        setNotifications([]);
      } catch (error) {
        console.error("Error clearing notifications:", error);
      }
    }
  };

  // MARK ALL AS READ
  const handleMarkAllAsRead = async () => {
    try {
      await fetch('http://localhost:8080/api/notifications/mark-all-read', { method: 'PUT' });
      const updatedNotifs = notifications.map(notif => ({ ...notif, is_read: true }));
      setNotifications(updatedNotifs);
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

// --- BAGONG FUNCTION: Pag-navigate base sa notification type ---
// --- BAGONG FUNCTION: Pag-navigate base sa notification type ---
  const handleNotifClick = async (notif) => { // <-- Ginawang async
      // 1. Kung hindi pa nababasa, i-update sa database at sa UI
      if (!notif.is_read) {
          // Update UI agad para mabilis ang feeling
          const updated = notifications.map(n => n.id === notif.id ? { ...n, is_read: true } : n);
          setNotifications(updated);

          // IDINAGDAG: Sabihan ang database na nabasa na ito!
          try {
              await fetch(`http://localhost:8080/api/notifications/${notif.id}/read`, {
                  method: 'PUT'
              });
          } catch (error) {
              console.error("Error marking notification as read:", error);
          }
      }

      // 2. Pumunta sa tamang page base sa Routes mo!
      if (notif.type === 'project') {
          navigate('../job-order', { state: { targetProjectId: notif.reference_id } }); 
      } else if (notif.type === 'verification') {
          navigate('../project-verification', { state: { targetTaskId: notif.reference_id } });
      }
  };

  if (loading) return <div className="notif-container"><p style={{textAlign: 'center'}}>Loading notifications...</p></div>;

  return (
    <div className="notif-container">
      <h1 className="notif-header">
        <span className="notif-bell"></span> Notifications
      </h1>

      <div className="notif-list">
        {notifications.length > 0 ? (
          notifications.map((notif) => (
            // IDINAGDAG: onClick sa buong row at cursor: pointer
            <div 
                key={notif.id} 
                className={`notif-item ${notif.is_read ? 'read' : 'unread'}`}
                onClick={() => handleNotifClick(notif)}
                style={{ cursor: 'pointer' }}
            >
              <div className="notif-content">
                <div className="notif-title">{notif.title}</div>
                <div className="notif-message">{notif.message}</div>
              </div>
              
              <button 
                className="notif-delete-btn" 
                // IDINAGDAG: e.stopPropagation() para hindi mapunta sa kabilang page pag dinelete!
                onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(notif.id);
                }}
                title="Delete Notification"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                  <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                </svg>
              </button>
            </div>
          ))
        ) : (
          <div className="notif-empty">
            No new notifications.
          </div>
        )}
      </div>

      {notifications.length > 0 && (
        <div className="notif-actions">
          <button className="notif-btn-secondary" onClick={handleClearAll}>
            Clear All
          </button>
          <button className="notif-btn-primary" onClick={handleMarkAllAsRead}>
            Mark All as Read
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminNotification;