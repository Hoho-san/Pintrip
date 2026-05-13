import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import MapPage    from './pages/MapPage'
import GalleryPage from './pages/GalleryPage'
import AuthPage   from './pages/AuthPage'
import NavBar     from './components/UI/NavBar'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // Loading state
  if (session === undefined) {
    return (
      // In the loading return block, change:
      <div className="flex h-screen items-center justify-center bg-surface-bg dark:bg-dark-bg">
        <div className="flex flex-col items-center gap-3">
          <PintripLogo />
          <p className="text-sm text-text-muted dark:text-dark-muted">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      {session && <NavBar session={session} />}
      <Routes>
        <Route path="/auth" element={session ? <Navigate to="/" /> : <AuthPage />} />
        <Route path="/"       element={session ? <MapPage session={session} /> : <Navigate to="/auth" />} />
        <Route path="/gallery" element={session ? <GalleryPage session={session} /> : <Navigate to="/auth" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

function PintripLogo() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-label="Pintrip logo">
      <circle cx="24" cy="20" r="13" fill="#01696f" />
      <circle cx="24" cy="20" r="7"  fill="#fff" />
      <circle cx="24" cy="20" r="3"  fill="#01696f" />
      <path d="M24 33 L24 46" stroke="#01696f" strokeWidth="3" strokeLinecap="round"/>
      <ellipse cx="24" cy="46" rx="6" ry="2" fill="#cedcd8" />
    </svg>
  )
}
