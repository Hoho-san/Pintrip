/**
 * StatsBar — displays total countries, cities, photos counts at the top of the map.
 */
export default function StatsBar({ places = [], photoCount = 0 }) {
  const countries = new Set(places.map((p) => p.country).filter(Boolean)).size
  const cities    = places.length

  const stats = [
    { label: 'Countries', value: countries, icon: '🌍' },
    { label: 'Cities',    value: cities,    icon: '📍' },
    { label: 'Photos',    value: photoCount, icon: '📸' },
  ]

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[900] flex gap-2 pointer-events-none">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-surface-bg/90 backdrop-blur border border-border rounded-full px-3 py-1 flex items-center gap-1.5 shadow-sm"
        >
          <span className="text-sm" aria-hidden="true">{s.icon}</span>
          <span className="text-sm font-medium text-text tabular-nums">{s.value}</span>
          <span className="text-xs text-text-muted hidden sm:inline">{s.label}</span>
        </div>
      ))}
    </div>
  )
}
