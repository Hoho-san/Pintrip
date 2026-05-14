import { useEffect, useRef } from 'react'
import { Marker } from 'react-leaflet'
import L from 'leaflet'

const PIN_SVG = (color = '#01696f', inner = '#ffffff') => `
  <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 9.9 14 22 14 22S28 23.9 28 14C28 6.268 21.732 0 14 0z"
          fill="${color}"/>
    <circle cx="14" cy="14" r="5.5" fill="${inner}"/>
  </svg>
`

const FLAG_SVG = (color = '#01696f', pole = '#888888') => `
  <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="2" width="2.5" height="34" rx="1.25" fill="${pole}"/>
    <path d="M6.5 3 L24 9 L6.5 18 Z" fill="${color}"/>
  </svg>
`

function getThemeMode() {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function buildIcon(place, isSelected, markerStyle) {
  const label = place.name.length > 8 ? `${place.name.slice(0, 7)}…` : place.name
  const hasPhoto = !!(place.cover_signed_url || place.cover_photo)
  const style = markerStyle || place.marker_style || (hasPhoto ? 'photo' : 'pin')
  const theme = getThemeMode()

  const selectedClass = isSelected ? ' selected' : ''
  const activeColor = theme === 'dark'
  ? (isSelected ? '#00a2e2' : '#dd3434')
  : (isSelected ? '#00a2e2' : '#dd3434')

  const flagPole = theme === 'dark' ? '#c7c7c7' : '#888888'
  const pinInner = theme === 'dark' ? '#171614' : '#ffffff'

  let html = ''
  let iconSize = [52, 66]
  let iconAnchor = [26, 66]

  if (style === 'photo' && hasPhoto) {
    const src = place.cover_signed_url || place.cover_photo
    html = `
      <div class="polaroid-pin${selectedClass}">
        <img src="${src}" alt="${place.name}" loading="lazy" />
        <div class="pin-label">${label}</div>
      </div>
    `
    iconSize = [52, 66]
    iconAnchor = [26, 66]
  } else if (style === 'flag') {
    html = `
      <div class="icon-pin${selectedClass}">
        ${FLAG_SVG(activeColor, flagPole)}
        <div class="pin-label">${label}</div>
      </div>
    `
    iconSize = [32, 50]
    iconAnchor = [5, 36]
  } else {
    html = `
      <div class="icon-pin${selectedClass}">
        ${PIN_SVG(activeColor, pinInner)}
        <div class="pin-label">${label}</div>
      </div>
    `
    iconSize = [28, 50]
    iconAnchor = [14, 36]
  }

  return L.divIcon({
    html,
    className: '',
    iconSize,
    iconAnchor,
    popupAnchor: [0, -36],
  })
}

export default function PhotoPin({ place, isSelected, onClick, markerStyle }) {
  const markerRef = useRef(null)
  const icon = buildIcon(place, isSelected, markerStyle)

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setIcon(buildIcon(place, isSelected, markerStyle))
    }
  }, [
    isSelected,
    place.cover_photo,
    place.cover_signed_url,
    place.name,
    place.marker_style,
    markerStyle,
  ])

  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (markerRef.current) {
        markerRef.current.setIcon(buildIcon(place, isSelected, markerStyle))
      }
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  }, [place, isSelected, markerStyle])

  return (
    <Marker
      position={[place.lat, place.lng]}
      icon={icon}
      ref={markerRef}
      eventHandlers={{ click: onClick }}
    />
  )
}