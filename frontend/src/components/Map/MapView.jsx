import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Map, MapControls, useMap } from '@/components/ui/map'
import PhotoPin from './PhotoPin'
import { useAppContext } from '../../ThemeContext'

// Red pin as a data-URI cursor (same shape as PhotoPin's PinIcon); the
// hotspot (11 27) is the pin's tip so it points exactly where you click
const PIN_CURSOR =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='28' viewBox='0 0 28 36'%3E` +
  `%3Cpath d='M14 0C6.268 0 0 6.268 0 14c0 9.9 14 22 14 22S28 23.9 28 14C28 6.268 21.732 0 14 0z' fill='%23dd3434'/%3E` +
  `%3Ccircle cx='14' cy='14' r='5.5' fill='white'/%3E%3C/svg%3E") 11 27, crosshair`

function CursorHint({ text }) {
  const { map } = useMap()
  const [pos, setPos] = useState(null)

  useEffect(() => {
    if (!map) return
    const canvas = map.getCanvas()
    const container = map.getContainer()
    canvas.style.cursor = PIN_CURSOR

    const handleMove = (e) => {
      // Only over the map itself — hide when hovering pins, popups, controls
      if (e.target !== canvas) {
        setPos(null)
        return
      }
      const rect = container.getBoundingClientRect()
      setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
    const handleLeave = () => setPos(null)

    container.addEventListener('mousemove', handleMove)
    container.addEventListener('mouseleave', handleLeave)
    return () => {
      canvas.style.cursor = ''
      container.removeEventListener('mousemove', handleMove)
      container.removeEventListener('mouseleave', handleLeave)
    }
  }, [map])

  if (!map || !pos) return null

  return createPortal(
    <div
      className="pointer-events-none absolute z-[950] whitespace-nowrap
                 bg-surface-bg/90 dark:bg-dark-surface/90 backdrop-blur
                 border border-border dark:border-dark-border rounded-full
                 px-2.5 py-1 text-xs text-text-muted dark:text-dark-muted shadow-sm"
      style={{ left: pos.x + 16, top: pos.y - 30}}
    >
      {text}
    </div>,
    map.getContainer()
  )
}

function ClickHandler({ onMapClick, onMapDblClick }) {
  const { map } = useMap()

  useEffect(() => {
    if (!map) return
    const handleClick = (e) => onMapClick(e.lngLat.lat, e.lngLat.lng)
    const handleDblClick = (e) => {
      e.preventDefault()
      onMapDblClick(e.lngLat.lat, e.lngLat.lng)
    }
    map.on('click', handleClick)
    map.on('dblclick', handleDblClick)
    return () => {
      map.off('click', handleClick)
      map.off('dblclick', handleDblClick)
    }
  }, [map, onMapClick, onMapDblClick])

  return null
}

function AutoFocusCountry({ places = [] }) {
  const { map } = useMap()

  useEffect(() => {
    if (!map || !places.length) return

    const grouped = places.reduce((acc, place) => {
      const country = place.country || 'Unknown'
      if (!acc[country]) acc[country] = { photoCount: 0, coords: [] }
      acc[country].photoCount += place.photo_count || 0
      acc[country].coords.push([place.lng, place.lat])
      return acc
    }, {})

    const topCountry = Object.values(grouped).sort((a, b) => b.photoCount - a.photoCount)[0]
    if (!topCountry?.coords.length) return

    const coordsToUse =
      topCountry.photoCount > 0
        ? topCountry.coords
        : places.map((p) => [p.lng, p.lat])

    if (coordsToUse.length === 1) {
      map.flyTo({ center: coordsToUse[0], zoom: 6, duration: 1200 })
      return
    }

    const lngs = coordsToUse.map(([lng]) => lng)
    const lats = coordsToUse.map(([, lat]) => lat)
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 48, maxZoom: 6 }
    )
  }, [places, map])

  return null
}

export default function MapView({ places = [], onMapClick, onMapDblClick, onPinClick, selectedId }) {
  const { markerStyle, theme } = useAppContext()

  return (
    <Map
      theme={theme}
      center={[0, 20]}
      zoom={2}
      minZoom={2}
      // A full ±180 span crashes MapLibre (maplibre-gl-js#6148), so stay just inside it
      maxBounds={[[-179.9, -85], [179.9, 85]]}
      // Double-click opens the add-pin form instead of zooming
      doubleClickZoom={false}
      className="w-full h-full"
    >
      <MapControls position="bottom-right" />

      <ClickHandler onMapClick={onMapClick} onMapDblClick={onMapDblClick} />
      <CursorHint text="Double-click to pin on the map" />
      <AutoFocusCountry places={places} />

      {places.map((place) => (
        <PhotoPin
          key={place.id}
          place={place}
          isSelected={place.id === selectedId}
          onClick={() => onPinClick(place)}
          markerStyle={markerStyle}
        />
      ))}
    </Map>
  )
}
