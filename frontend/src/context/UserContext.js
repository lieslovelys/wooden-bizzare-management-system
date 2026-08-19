import { createContext } from 'react';

// Split out of App.jsx (P2 lint fix): a file that only ever exports a component can hot-reload
// via react-refresh; App.jsx exporting both the App component *and* this context tripped
// react-refresh/only-export-components. See CLAUDE.md / ARCHITECTURE_REVIEW.md.
export const UserContext = createContext();
