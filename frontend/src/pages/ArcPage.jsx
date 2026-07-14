import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  Map,
  MapControls,
  MapArc,
  MapMarker,
  MarkerContent,
  MarkerLabel,
  MapPopup,
  useMap,
} from '@/components/ui/map'
import PhotoPin from '../components/Map/PhotoPin'
import { useAppContext } from '../ThemeContext'

// HOME is a per-user client-side preference (not part of the places schema),
// so it lives in localStorage keyed by user id.
const homeStorageKey = (userId) => `pintrip:home:${userId}`

function loadHome(userId) {
  if (!userId) return null
  try {
    const raw = localStorage.getItem(homeStorageKey(userId))
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number'
      ? parsed
      : null
  } catch {
    return null
  }
}

function saveHome(userId, home) {
  if (!userId) return
  localStorage.setItem(homeStorageKey(userId), JSON.stringify(home))
}

function ClickHandler({ onMapClick }) {
  const { map } = useMap()

  useEffect(() => {
    if (!map) return
    const handleClick = (e) => onMapClick(e.lngLat.lat, e.lngLat.lng)
    map.on('click', handleClick)
    return () => map.off('click', handleClick)
  }, [map, onMapClick])

  return null
}

function FitToAll({ home, places = [] }) {
  const { map } = useMap()

  useEffect(() => {
    if (!map) return

    const coords = [
      ...(home ? [[home.lng, home.lat]] : []),
      ...places.map((p) => [p.lng, p.lat]),
    ]
    if (!coords.length) return

    if (coords.length === 1) {
      map.flyTo({ center: coords[0], zoom: 3, duration: 1200 })
      return
    }

    const lngs = coords.map(([lng]) => lng)
    const lats = coords.map(([, lat]) => lat)
    // Cap the zoom so the view keeps the globe feel instead of flattening out
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 64, maxZoom: 4, duration: 1200 }
    )
  }, [map, home, places])

  return null
}

function FlyTo({ target }) {
  const { map } = useMap()

  useEffect(() => {
    if (!map || !target) return
    map.flyTo({ center: [target.lng, target.lat], zoom: 8, duration: 1200 })
  }, [map, target])

  return null
}

function HomeMarker({ home, onClick }) {
  return (
    <MapMarker longitude={home.lng} latitude={home.lat} onClick={onClick}>
      <MarkerContent>
        <div
          title="Your HOME point — click to move it"
          className="w-9 h-9 rounded-full bg-primary dark:bg-dark-primary
                     border-2 border-white shadow-lg
                     flex items-center justify-center text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <MarkerLabel className="font-semibold tracking-wide">HOME</MarkerLabel>
      </MarkerContent>
    </MapMarker>
  )
}

export default function ArcPage({ session, places = [] }) {
  const { theme, markerStyle } = useAppContext()
  const userId = session?.user?.id

  const [home, setHome] = useState(() => loadHome(userId))
  const [settingHome, setSettingHome] = useState(false)
  const [hoverInfo, setHoverInfo] = useState(null)
  const [flyTarget, setFlyTarget] = useState(null)

  useEffect(() => {
    setHome(loadHome(userId))
  }, [userId])

  const arcColor = theme === 'dark' ? '#6fa8ff' : '#4285F4'

  const arcs = useMemo(() => {
    if (!home) return []
    return places.map((place) => ({
      id: place.id,
      from: [home.lng, home.lat],
      to: [place.lng, place.lat],
      name: place.name,
      lat: place.lat,
      lng: place.lng,
    }))
  }, [home, places])

  const handleMapClick = useCallback(
    (lat, lng) => {
      if (home && !settingHome) return
      const next = { lat, lng }
      setHome(next)
      saveHome(userId, next)
      setSettingHome(false)
    },
    [home, settingHome, userId]
  )

  const handleArcHover = useCallback((event) => {
    setHoverInfo(
      event
        ? { lng: event.longitude, lat: event.latitude, name: event.arc.name }
        : null
    )
  }, [])

  const handleArcClick = useCallback(({ arc }) => {
    setFlyTarget({ lng: arc.lng, lat: arc.lat, ts: Date.now() })
  }, [])

  const pickingHome = !home || settingHome

  return (
    <div className="fixed inset-0 pt-12">
      <Map
        center={[0, 20]}
        zoom={1.6}
        minZoom={0.8}
        projection={{ type: 'globe' }}
        className="w-full h-full"
      >
        <MapControls position="bottom-right" />

        <ClickHandler onMapClick={handleMapClick} />
        <FitToAll home={home} places={places} />
        <FlyTo target={flyTarget} />

        {home && arcs.length > 0 && (
          <MapArc
            data={arcs}
            curvature={0.25}
            paint={{
              'line-color': arcColor,
              'line-width': 2,
              'line-opacity': 0.9,
              'line-dasharray': [2, 2],
            }}
            layout={{ 'line-cap': 'butt' }}
            hoverPaint={{ 'line-width': 3.5, 'line-opacity': 1 }}
            onHover={handleArcHover}
            onClick={handleArcClick}
          />
        )}

        {home && <HomeMarker home={home} onClick={() => setSettingHome(true)} />}

        {places.map((place) => (
          <PhotoPin
            key={place.id}
            place={place}
            isSelected={false}
            onClick={() => setFlyTarget({ lng: place.lng, lat: place.lat, ts: Date.now() })}
            markerStyle={markerStyle}
          />
        ))}

        {hoverInfo && (
          <MapPopup
            longitude={hoverInfo.lng}
            latitude={hoverInfo.lat}
            offset={10}
            className="px-2 py-1 text-xs pointer-events-none"
          >
            HOME → {hoverInfo.name}
          </MapPopup>
        )}
      </Map>

      {pickingHome && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[900]
                        flex items-center gap-3
                        bg-surface-bg/90 dark:bg-dark-surface/90 backdrop-blur
                        border border-border dark:border-dark-border rounded-full
                        px-4 py-2 text-sm text-text-muted dark:text-dark-muted shadow-sm">
          <span>Click anywhere on the map to {home ? 'move' : 'set'} your HOME point 🏠</span>
          {settingHome && (
            <button
              onClick={() => setSettingHome(false)}
              className="text-xs font-medium text-primary dark:text-dark-primary hover:underline"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {home && !settingHome && (
        <div className="absolute top-16 left-4 z-[900]
                        bg-surface-bg/90 dark:bg-dark-surface/90 backdrop-blur
                        border border-border dark:border-dark-border rounded-md
                        px-3 py-2 shadow-sm flex items-center gap-3">
          <span className="text-xs text-text-muted dark:text-dark-muted">
            {places.length
              ? `${places.length} place${places.length === 1 ? '' : 's'} from HOME`
              : 'No places yet — drop pins on the Map page'}
          </span>
          <button
            onClick={() => setSettingHome(true)}
            className="text-xs font-medium text-primary dark:text-dark-primary hover:underline"
          >
            Move HOME
          </button>
        </div>
      )}
    </div>
  )
}
