import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // IDINAGDAG: Para makalipat ng page
import '../css/admin.css';
import { api } from '../api/client';

const AdminNotification = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // IDINAGDAG: Initialize ang navigate function
  const navigate = useNavigate();

  // FETCH: Kunin ang data sa database pagka-load ng page
  const fetchNotifications = async () => {
    try {
      const data = await api.get('/api/notifications');
      setNotifications(data);
    } catch (error) {
      console.error("Error fetching notifications:", error.message);
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
      await api.delete(`/api/notifications/${id}`);
      setNotifications(notifications.filter(notif => notif.id !== id));
    } catch (error) {
      console.error("Error deleting notification:", error.message);
    }
  };

  // CLEAR ALL
  const handleClearAll = async () => {
    if(window.confirm("Are you sure you want to clear all notifications?")) {
      try {
        await api.delete('/api/notifications/clear/all');
        setNotifications([]);
      } catch (error) {
        console.error("Error clearing notifications:", error.message);
      }
    }
  };

  // MARK ALL AS READ
  const handleMarkAllAsRead = async () => {
    try {
      await api.put('/api/notifications/mark-all-read');
      const updatedNotifs = notifications.map(notif => ({ ...notif, is_read: true }));
      setNotifications(updatedNotifs);
    } catch (error) {
      console.error("Error marking all as read:", error.message);
    }
  };

// --- BAGONG FUNCTION: Pag-navigate base sa notification type ---
  const handleNotifClick = async (notif) => { 
      // 1. Kung hindi pa nababasa, i-update sa database at sa UI
      if (!notif.is_read) {
          // Update UI agad para mabilis ang feeling
          const updated = notifications.map(n => n.id === notif.id ? { ...n, is_read: true } : n);
          setNotifications(updated);

          // IDINAGDAG: Sabihan ang database na nabasa na ito!
          try {
              await api.put(`/api/notifications/${notif.id}/read`);
          } catch (error) {
              console.error("Error marking notification as read:", error.message);
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
            <div 
                key={notif.id} 
                className={`notif-item ${notif.is_read ? 'read' : 'unread'}`}
                onClick={() => handleNotifClick(notif)}
                style={{ cursor: 'pointer' }}
            >
                {/* --- PREMIUM SVG ICONS IMBAES NA EMOJI --- */}
                <div className="notif-icon-wrapper">
                    {notif.type === 'project' ? (
                        /* PROJECT ICON: Document / Blueprint (Kulay Ginto) */
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                    ) : notif.type === 'verification' ? (
                        /* VERIFICATION ICON: Checkmark Circle (Kulay Dark Brown) */
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5a4a00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                    ) : (
                        /* DEFAULT ICON (Kung may iba pang type) */
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b816a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                    )}
                </div>

                <div className="notif-content">
                    <div className="notif-title-row">
                        <div className="notif-title">{notif.title}</div>
                        {/* BAGONG ADD: Gold dot kung unread */}
                        {!notif.is_read && <span className="unread-dot"></span>}
                    </div>
                    <div className="notif-message">{notif.message}</div>
                </div>
                
                <button 
                    className="notif-delete-btn" 
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(notif.id);
                    }}
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
