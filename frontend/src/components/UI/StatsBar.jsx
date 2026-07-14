/**
 * StatsBar — displays total countries, cities, photos counts at the top of the map.
 */
const GlobeIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
)

const PinIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
)

const PhotoIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)

export default function StatsBar({ places = [], photoCount = 0 }) {
  const countries = new Set(places.map((p) => p.country).filter(Boolean)).size
  const cities    = places.length

  const stats = [
    { label: 'Countries', value: countries,  icon: GlobeIcon },
    { label: 'Cities',    value: cities,     icon: PinIcon },
    { label: 'Photos',    value: photoCount, icon: PhotoIcon },
  ]

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[900] flex gap-2 pointer-events-none">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-surface-bg/90 backdrop-blur border border-border rounded-full px-3 py-1 flex items-center gap-1.5 shadow-sm"
        >
          <span className="text-text-muted dark:text-dark-muted" aria-hidden="true">{s.icon}</span>
          <span className="text-sm font-medium text-text tabular-nums">{s.value}</span>
          <span className="text-xs text-text-muted hidden sm:inline">{s.label}</span>
        </div>
      ))}
    </div>
  )
}
