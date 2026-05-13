/**
 * PhotoPin.jsx
 * Renders a polaroid-style Leaflet marker using L.divIcon.
 * Uses a cover photo thumbnail if available, otherwise shows a teal dot placeholder.
 */
import { useEffect, useRef } from 'react'
import { Marker, useMap } from 'react-leaflet'
import L from 'leaflet'

function buildIcon(place, isSelected) {
  const label = place.name.length > 8 ? place.name.slice(0, 7) + '…' : place.name

  const imageSrc = place.cover_signed_url || place.cover_photo
const html = imageSrc
    ? `<div class="polaroid-pin${isSelected ? ' ring-2 ring-primary scale-110' : ''}">
         <img src="${imageSrc}" alt="${place.name}" loading="lazy" />
         <div class="pin-label">${label}</div>
       </div>`
    : `<div class="polaroid-pin-empty${isSelected ? ' ring-2 ring-primary' : ''}">
         <div class="pin-dot">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#01696f" stroke-width="2.5">
             <circle cx="12" cy="10" r="4"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
           </svg>
         </div>
         <div class="pin-label">${label}</div>
       </div>`

  return L.divIcon({
    html,
    className: '',
    iconSize:  [52, 66],
    iconAnchor:[26, 66],
    popupAnchor:[0, -66],
  })
}

export default function PhotoPin({ place, isSelected, onClick }) {
  const markerRef = useRef(null)
  const icon = buildIcon(place, isSelected)

  // Re-render icon when selection changes
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setIcon(buildIcon(place, isSelected))
    }
  }, [isSelected, place.cover_photo, place.name])

  return (
    <Marker
      position={[place.lat, place.lng]}
      icon={icon}
      ref={markerRef}
      eventHandlers={{ click: onClick }}
    />
  )
}
