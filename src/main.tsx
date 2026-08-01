import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { LandingPage } from './components/LandingPage.tsx'
import { DocsPage } from './components/DocsPage.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

// Routing lives here so the game (App.tsx) and its whole provider tree mount ONLY on /app —
// the public landing/docs pages stay lightweight (no wallet adapters) and the game logic is
// untouched. The 3-column game and all its hooks/context render exactly as before under /app.
//
// ErrorBoundary sits OUTSIDE the router so it covers every route — the game, the landing page
// and the docs page — and catches a throw from any component below it. Without it an
// unhandled render error unmounts the tree and leaves the player on a blank page.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<App />} />
          <Route path="/docs" element={<DocsPage />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
