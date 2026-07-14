import { useState, useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
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

function haversineKm(a, b) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

// Rough door-to-door estimate: short hops by car (~70 km/h average),
// longer trips by plane (~800 km/h cruise + 2h airport overhead)
function travelEstimate(from, to) {
  const km = haversineKm(from, to)
  const byPlane = km >= 700
  const hours = byPlane ? km / 800 + 2 : km / 70
  return {
    km: Math.round(km),
    hours: Math.round(hours * 10) / 10,
    mode: byPlane ? 'plane' : 'car',
  }
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

// Keeps the whole globe visible, sized to fill the map's height (top to bottom,
// small margin), re-fitting on window resize. Only rotates toward focusLng —
// never zooms into the pins.
function GlobeFit({ focusLng = 0 }) {
  const { map } = useMap()

  useEffect(() => {
    if (!map) return

    const fitZoom = () => {
      const h = map.getContainer().clientHeight
      if (!h) return null
      // Globe diameter in px ≈ (512 · 2^zoom) / π → solve zoom to fill ~92% of height
      return Math.log2((h * 1.4 * Math.PI) / 512)
    }

    const zoom = fitZoom()
    if (zoom !== null) map.easeTo({ center: [focusLng, 0], zoom, duration: 800 })

    const handleResize = () => {
      const z = fitZoom()
      if (z !== null) map.jumpTo({ zoom: z })
    }
    map.on('resize', handleResize)
    return () => map.off('resize', handleResize)
  }, [map, focusLng])

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
          <svg width="100" height="100" viewBox="0 0 24 24" fill="none"
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
  const [searchParams, setSearchParams] = useSearchParams()

  const [home, setHome] = useState(() => loadHome(userId))
  const [settingHome, setSettingHome] = useState(false)
  const [hoverInfo, setHoverInfo] = useState(null)
  const [flyTarget, setFlyTarget] = useState(null)

  useEffect(() => {
    setHome(loadHome(userId))
  }, [userId])

  const arcColor = theme === 'dark' ? '#6fa8ff' : '#4285F4'

  // AI-suggested next trip, passed in the URL by the chat bot:
  // /arc?dest=lat,lng&name=...&reason=...
  const trip = useMemo(() => {
    const dest = searchParams.get('dest')
    if (!dest) return null
    const [lat, lng] = dest.split(',').map(Number)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return {
      lat,
      lng,
      name: searchParams.get('name') || 'Destination',
      reason: searchParams.get('reason') || '',
    }
  }, [searchParams])

  const tripStats = useMemo(
    () => (home && trip ? travelEstimate(home, trip) : null),
    [home, trip]
  )

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

  // Which longitude faces the viewer: the suggested trip, else HOME, else the pins
  const focusLng = useMemo(() => {
    if (trip && home) return (home.lng + trip.lng) / 2
    if (trip) return trip.lng
    if (home) return home.lng
    if (places.length) return places.reduce((sum, p) => sum + p.lng, 0) / places.length
    return 0
  }, [trip, home, places])

  const pickingHome = !home || settingHome

  return (
    <div className="fixed inset-0 pt-12">
      <Map
        theme={theme}
        center={[0, 20]}
        zoom={1.6}
        minZoom={1}
        projection={{ type: 'globe' }}
        className="w-full h-full"
      >
        <MapControls position="bottom-right" />

        <ClickHandler onMapClick={handleMapClick} />
        <GlobeFit focusLng={focusLng} />
        <FlyTo target={flyTarget} />

        {home && arcs.length > 0 && (
          <MapArc
            id="history"
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

        {home && trip && (
          <MapArc
            data={[{ id: 'next-trip', from: [home.lng, home.lat], to: [trip.lng, trip.lat] }]}
            curvature={0.25}
            paint={{ 'line-color': '#f59e0b', 'line-width': 3, 'line-opacity': 1 }}
            interactive={false}
          />
        )}

        {trip && (
          <MapMarker longitude={trip.lng} latitude={trip.lat}>
            <MarkerContent>
              <div
                className="w-9 h-9 rounded-full bg-amber-500 border-2 border-white shadow-lg
                           flex items-center justify-center text-white text-lg"
                title={trip.name}
              >
                ✈️
              </div>
              <MarkerLabel className="font-semibold tracking-wide">{trip.name}</MarkerLabel>
            </MarkerContent>
          </MapMarker>
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

      {trip && home && tripStats && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[900] w-[min(92vw,24rem)]
                        bg-surface-bg/95 dark:bg-dark-surface/95 backdrop-blur
                        border border-border dark:border-dark-border rounded-lg
                        px-4 py-3 shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-text dark:text-dark-text">
                ✈️ Next trip: {trip.name}
              </div>
              <div className="text-xs text-text-muted dark:text-dark-muted mt-1">
                {tripStats.km.toLocaleString()} km from HOME · ~{tripStats.hours} h by {tripStats.mode}
              </div>
              {trip.reason && (
                <p className="text-xs text-text dark:text-dark-text mt-2 leading-relaxed">
                  {trip.reason}
                </p>
              )}
            </div>
            <button
              onClick={() => setSearchParams({})}
              aria-label="Clear suggested trip"
              className="text-xs font-medium text-text-muted dark:text-dark-muted
                         hover:text-text dark:hover:text-dark-text flex-shrink-0"
            >
              ✕ Clear
            </button>
          </div>
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
