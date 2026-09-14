import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// GitHub Pages SPA: 404.html stashes the deep link, then we restore it.
const redirect = sessionStorage.getItem('ghpages-redirect')
if (redirect) {
  sessionStorage.removeItem('ghpages-redirect')
  const url = new URL(redirect)
  if (url.pathname.startsWith('/harness-lab')) {
    history.replaceState(null, '', url.pathname + url.search + url.hash)
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
