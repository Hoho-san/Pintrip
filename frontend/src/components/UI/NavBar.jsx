import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function NavBar({ session }) {
  const loc = useLocation()

  return (
    <header className="fixed top-0 left-0 right-0 z-[1000] h-12 bg-surface-bg/90 backdrop-blur border-b border-border flex items-center px-4 gap-6">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 no-underline">
        <PintripLogoSmall />
        <span className="font-display text-lg font-medium text-text">Pintrip</span>
      </Link>

      {/* Nav links */}
      <nav className="flex items-center gap-1 ml-2">
        <NavLink to="/"        label="Map"     active={loc.pathname === '/'} />
        <NavLink to="/gallery" label="Gallery" active={loc.pathname === '/gallery'} />
      </nav>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-3">
        <span className="text-xs text-text-muted hidden sm:block truncate max-w-[180px]">
          {session?.user?.email}
        </span>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs text-text-muted hover:text-text transition-colors px-2 py-1 rounded-md hover:bg-surface-offset"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}

function NavLink({ to, label, active }) {
  return (
    <Link
      to={to}
      className={`
        px-3 py-1 rounded-md text-sm transition-colors no-underline
        ${active
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-text-muted hover:text-text hover:bg-surface-offset'}
      `}
    >
      {label}
    </Link>
  )
}

function PintripLogoSmall() {
  return (
    <svg width="24" height="24" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="20" r="13" fill="#01696f"/>
      <circle cx="24" cy="20" r="7"  fill="#fff"/>
      <circle cx="24" cy="20" r="3"  fill="#01696f"/>
      <path d="M24 33 L24 46" stroke="#01696f" strokeWidth="3" strokeLinecap="round"/>
      <ellipse cx="24" cy="46" rx="6" ry="2" fill="#cedcd8"/>
    </svg>
  )
}
