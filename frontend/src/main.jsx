import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Self-hosted fonts/icons (DESIGN.md §8, ARCHITECTURE_REVIEW.md items 27-28) — these used to load
// from Google Fonts and cdnjs via <link> tags in index.html (plus a leftover @import of the same
// Google Fonts URL in globals.css that item 27 missed — see item 28). Imported before globals.css
// so the @font-face rules exist before any stylesheet references the families. Only the Font
// Awesome solid font is loaded; nothing in the app uses fa-regular/fa-brands. 700/800 and
// Playfair 800 are real weights, not the browser's synthesized bold — a repo-wide check (item 28)
// found ~80 Inter 700/bold rules (table headers, labels, buttons), 4 Inter 800 rules, and 3
// Playfair 800 rules (.profit-net-value, .info-card-value, .prod-header-title) that were
// previously faked from the nearest loaded weight.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import '@fontsource/playfair-display/500.css'
import '@fontsource/playfair-display/600.css'
import '@fontsource/playfair-display/700.css'
import '@fontsource/playfair-display/800.css'
import '@fortawesome/fontawesome-free/css/fontawesome.min.css'
import '@fortawesome/fontawesome-free/css/solid.min.css'
import './css/globals.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
