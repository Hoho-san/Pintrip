import { Link, useLocation } from 'react-router-dom'
import { useAppContext } from '../../ThemeContext'

const MARKER_OPTIONS = [
  {
    value: 'photo',
    label: 'Photo',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    ),
  },
  {
    value: 'pin',
    label: 'Pin',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    ),
  },
  {
    value: 'flag',
    label: 'Flag',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
        <line x1="4" y1="22" x2="4" y2="15"/>
      </svg>
    ),
  },
]

export default function NavBar({ session, onSignOut }) {
  const loc = useLocation()
  const { theme, toggle, markerStyle, setMarkerStyle } = useAppContext()

  return (
    <header className="fixed top-0 left-0 right-0 z-[1000] h-12
                        bg-surface-bg/90 dark:bg-dark-bg/90
                        backdrop-blur border-b border-border dark:border-dark-border
                        flex items-center px-4 gap-4">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 no-underline flex-shrink-0">
        <PintripLogoSmall />
        <span className="font-display text-lg font-medium text-text dark:text-dark-text">
          Pintrip
        </span>
      </Link>

      {/* Nav links */}
      <nav className="flex items-center gap-1 ml-2">
        <NavLink to="/"        label="Map"     active={loc.pathname === '/'} />
        <NavLink to="/gallery" label="Gallery" active={loc.pathname === '/gallery'} />
      </nav>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2">

        {/* Marker style picker */}
        <div className="flex items-center gap-1 border border-border dark:border-dark-border
                        rounded-md px-1 py-0.5">
          {MARKER_OPTIONS.map((opt) => {
            const active = markerStyle === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setMarkerStyle(opt.value)}
                aria-label={`Marker style: ${opt.label}`}
                title={opt.label}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium
                            transition-colors
                            ${active
                              ? 'bg-primary/15 text-primary dark:text-dark-primary'
                              : 'text-text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text hover:bg-surface-offset dark:hover:bg-dark-offset2'
                            }`}
              >
                {opt.icon}
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            )
          })}
        </div>

        <span className="text-xs text-text-muted dark:text-dark-muted hidden sm:block truncate max-w-[180px]">
          {session?.user?.email}
        </span>

        {/* Dark mode toggle */}
        <button
          onClick={toggle}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="w-8 h-8 flex items-center justify-center rounded-md
                     text-text-muted dark:text-dark-muted
                     hover:text-text dark:hover:text-dark-text
                     hover:bg-surface-offset dark:hover:bg-dark-offset2
                     transition-colors"
        >
          {theme === 'dark' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>

        <button
          onClick={onSignOut}
          className="text-xs text-text-muted dark:text-dark-muted
                     hover:text-text dark:hover:text-dark-text
                     transition-colors px-2 py-1 rounded-md
                     hover:bg-surface-offset dark:hover:bg-dark-offset2"
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
          ? 'bg-primary/10 dark:bg-dark-primary/15 text-primary dark:text-dark-primary font-medium'
          : 'text-text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text hover:bg-surface-offset dark:hover:bg-dark-offset2'}
      `}
    >
      {label}
    </Link>
  )
}

function PintripLogoSmall() {
  return (
    <svg width="24" height="24" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="20" r="13" fill="currentColor" className="text-primary dark:text-dark-primary"/>
      <circle cx="24" cy="20" r="7"  fill="white"/>
      <circle cx="24" cy="20" r="3"  fill="currentColor" className="text-primary dark:text-dark-primary"/>
      <path d="M24 33 L24 46" stroke="currentColor" className="text-primary dark:text-dark-primary" strokeWidth="3" strokeLinecap="round"/>
      <ellipse cx="24" cy="46" rx="6" ry="2" fill="currentColor" className="text-primary dark:text-dark-primary" opacity="0.3"/>
    </svg>
  )
}