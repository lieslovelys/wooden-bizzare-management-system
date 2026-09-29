import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Self-hosted fonts/icons (DESIGN.md §8, ARCHITECTURE_REVIEW.md item 27) — these used to load
// from Google Fonts and cdnjs via <link> tags in index.html. Imported before globals.css so the
// @font-face rules exist before any stylesheet references the families. Only the Font Awesome
// solid font is loaded; nothing in the app uses fa-regular/fa-brands.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/playfair-display/500.css'
import '@fontsource/playfair-display/600.css'
import '@fontsource/playfair-display/700.css'
import '@fortawesome/fontawesome-free/css/fontawesome.min.css'
import '@fortawesome/fontawesome-free/css/solid.min.css'
import './css/globals.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
