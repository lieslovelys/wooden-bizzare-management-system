import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; 
import '../css/admin.css';

const VerificationNotification = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const navigate = useNavigate();

  // FETCH: Kunin ang data sa database pagka-load ng page
  const fetchNotifications = async () => {
    try {
      // FIX 1: Tinanggal ang localhost
      const response = await fetch('/api/notifications'); 
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

  // --- BAGONG LOGIC: FILTERING ---
  // Sasalain natin para 'verification' type lang ang matira
  const verificationNotifs = notifications.filter(notif => notif.type === 'verification');

  // DELETE ONE
  const handleDelete = async (id) => {
    try {
      // FIX 2: Tinanggal ang localhost
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
      setNotifications(notifications.filter(notif => notif.id !== id));
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  // CLEAR ALL (Pansinin: Pwede nitong ma-clear pati project notifs kung hindi naka-separate sa backend)
  const handleClearAll = async () => {
    if(window.confirm("Are you sure you want to clear all verification notifications?")) {
      try {
        // Option A: Kung gusto mong isa-isang i-delete ang verification lang
        for (let notif of verificationNotifs) {
            // FIX 3: Tinanggal ang localhost
            await fetch(`/api/notifications/${notif.id}`, { method: 'DELETE' });
        }
        
        // Tanggalin sa UI
        const remainingNotifs = notifications.filter(n => n.type !== 'verification');
        setNotifications(remainingNotifs);
      } catch (error) {
        console.error("Error clearing notifications:", error);
      }
    }
  };

  // MARK ALL AS READ (Para lang sa verification notifs)
  const handleMarkAllAsRead = async () => {
    try {
      for (let notif of verificationNotifs) {
          if (!notif.is_read) {
              // FIX 4: Tinanggal ang localhost
              await fetch(`/api/notifications/${notif.id}/read`, { method: 'PUT' });
          }
      }
      
      const updatedNotifs = notifications.map(notif => 
          notif.type === 'verification' ? { ...notif, is_read: true } : notif
      );
      setNotifications(updatedNotifs);
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  // PAG-CLICK NG NOTIFICATION
  const handleNotifClick = async (notif) => {
      if (!notif.is_read) {
          const updated = notifications.map(n => n.id === notif.id ? { ...n, is_read: true } : n);
          setNotifications(updated);

          try {
              // FIX 5: Tinanggal ang localhost
              await fetch(`/api/notifications/${notif.id}/read`, { method: 'PUT' });
          } catch (error) {
              console.error("Error marking notification as read:", error);
          }
      }

      // Direkta na itong pupunta sa project-verification dahil puro verification lang ang nandito
      navigate('../project-verification', { state: { targetTaskId: notif.reference_id } });
  };

  if (loading) return <div className="notif-container"><p style={{textAlign: 'center'}}>Loading notifications...</p></div>;

  return (
    <div className="notif-container">
      <h1 className="notif-header">
        <span className="notif-bell"></span> Notifications
      </h1>

      <div className="notif-list">
        {/* GINAMIT NATIN ANG 'verificationNotifs' IMBES NA 'notifications' */}
        {verificationNotifs.length > 0 ? (
          verificationNotifs.map((notif) => (
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
            No new tasks to verify.
          </div>
        )}
      </div>

      {verificationNotifs.length > 0 && (
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

export default VerificationNotification;
