import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Self-hosted fonts/icons (DESIGN.md §8, ARCHITECTURE_REVIEW.md items 27-28) — these used to load
// from Google Fonts and cdnjs via <link> tags in index.html (plus a leftover @import of the same
// Google Fonts URL in globals.css that item 27 missed — see item 28). Imported before globals.css
// so the @font-face rules exist before any stylesheet references the families. Only the Font
// Awesome solid font is loaded; nothing in the app uses fa-regular/fa-brands.
//
// Item 43: Inter + Playfair Display (a serif, read as "vintage") replaced with a single sans,
// Geist, via globals.css's --font-sans token — see that file's :root. 700/800 are real weights,
// not the browser's synthesized bold, matching the same weights the CSS already asks for (item
// 28's lesson about faked weights applies here too).
//
// Item 45: Playfair Display comes back, but narrowly — only the "The Wooden Bizarre" brand
// wordmark uses it now (globals.css's --font-brand token), not headings generally. Weight 700
// only, the one weight the three wordmark sites actually ask for.
import '@fontsource/geist/400.css'
import '@fontsource/geist/500.css'
import '@fontsource/geist/600.css'
import '@fontsource/geist/700.css'
import '@fontsource/geist/800.css'
import '@fontsource/playfair-display/700.css'
import '@fortawesome/fontawesome-free/css/fontawesome.min.css'
import '@fortawesome/fontawesome-free/css/solid.min.css'
import './css/globals.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
