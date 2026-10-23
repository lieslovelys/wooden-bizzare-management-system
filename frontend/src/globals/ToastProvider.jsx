import { useCallback, useEffect, useRef, useState } from 'react';
import { ToastContext } from '../context/ToastContext';

// Single toast host for the whole app — replaces the identical wb-toast state/timer/markup that
// used to be copy-pasted into 12 components (see ARCHITECTURE_REVIEW.md P2). Mounted once in
// App.jsx; .wb-toast-container is `position: fixed` (css/globals.css), so rendering it here is
// visually identical to the old per-component rendering.
const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const timerRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    // Clear any in-flight dismiss timer first, so a toast fired while another is still showing
    // gets its own full 3s window instead of being cut short by the earlier timer — every one
    // of the 12 original copies had this bug.
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setToast({ visible: true, message, type });
    timerRef.current = setTimeout(() => {
      setToast({ visible: false, message: '', type: 'success' });
      timerRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // item 49 (REDESIGN-v2.md) — the variant is now shown by icon + color, not color alone
  // (DESIGN.md §3 rule 10's "nothing by color alone" applies to this non-text indicator too).
  const icon = toast.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check';

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast.visible && (
        <div className="wb-toast-container">
          <div className={`wb-toast ${toast.type}`}>
            <i className={`fa-solid ${icon} wb-toast-icon`} aria-hidden="true"></i>
            <span className="wb-toast-message">{toast.message}</span>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};

export default ToastProvider;
