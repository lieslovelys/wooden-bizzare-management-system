import { createContext, useContext } from 'react';

// Split from ToastProvider.jsx so this file exports no component — keeps it exempt from the
// react-refresh/only-export-components rule (see CLAUDE.md / ARCHITECTURE_REVIEW.md P2, same
// reasoning as the App.jsx UserContext split).
export const ToastContext = createContext(() => {});

// useToast() returns showToast(message, type = 'success'), replacing the 12 copy-pasted
// per-component implementations.
export const useToast = () => useContext(ToastContext);
