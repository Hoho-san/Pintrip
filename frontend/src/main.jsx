import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'   // ← this line is missing
import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { AppProvider } from './ThemeContext'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
      <Analytics />
    </BrowserRouter>
  </StrictMode>
)