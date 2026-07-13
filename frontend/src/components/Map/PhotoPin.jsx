import { MapMarker, MarkerContent } from '@/components/ui/map'

function PinIcon({ color }) {
  return (
    <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M14 0C6.268 0 0 6.268 0 14c0 9.9 14 22 14 22S28 23.9 28 14C28 6.268 21.732 0 14 0z"
        fill={color}
      />
      <circle cx="14" cy="14" r="5.5" className="fill-white dark:fill-dark-bg" />
    </svg>
  )
}

function FlagIcon({ color }) {
  return (
    <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="2" width="2.5" height="34" rx="1.25" className="fill-[#888888] dark:fill-[#c7c7c7]" />
      <path d="M6.5 3 L24 9 L6.5 18 Z" fill={color} />
    </svg>
  )
}

export default function PhotoPin({ place, isSelected, onClick, markerStyle }) {
  const label = place.name.length > 8 ? `${place.name.slice(0, 7)}…` : place.name
  const hasPhoto = !!(place.cover_signed_url || place.cover_photo)
  const style = markerStyle || place.marker_style || (hasPhoto ? 'photo' : 'pin')
  const selectedClass = isSelected ? ' selected' : ''
  const color = isSelected ? '#00a2e2' : '#dd3434'

  const handleClick = (e) => {
    // Keep the map's click handler (deselect / add-pin) from also firing
    e.stopPropagation()
    onClick()
  }

  if (style === 'photo' && hasPhoto) {
    const src = place.cover_signed_url || place.cover_photo
    return (
      <MapMarker
        longitude={place.lng}
        latitude={place.lat}
        anchor="bottom"
        onClick={handleClick}
      >
        <MarkerContent>
          <div className={`polaroid-pin${selectedClass}`}>
            <img src={src} alt={place.name} loading="lazy" />
            <div className="pin-label">{label}</div>
          </div>
        </MarkerContent>
      </MapMarker>
    )
  }

  const isFlag = style === 'flag'

  return (
    <MapMarker
      longitude={place.lng}
      latitude={place.lat}
      anchor="bottom"
      // Shift the flag so the pole base (not the svg center) sits on the coordinate
      offset={isFlag ? [9, 0] : [0, 0]}
      onClick={handleClick}
    >
      <MarkerContent>
        <div className={`icon-pin${selectedClass} relative`}>
          {isFlag ? <FlagIcon color={color} /> : <PinIcon color={color} />}
          <div
            className={`pin-label absolute top-full ${
              isFlag ? 'left-0' : 'left-1/2 -translate-x-1/2'
            }`}
          >
            {label}
          </div>
        </div>
      </MarkerContent>
    </MapMarker>
  )
}
