import { useEffect } from 'react'
import { Map, MapControls, useMap } from '@/components/ui/map'
import PhotoPin from './PhotoPin'
import { useAppContext } from '../../ThemeContext'

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

export default function MapView({ places = [], onMapClick, onPinClick, selectedId }) {
  const { markerStyle } = useAppContext()

  return (
    <Map
      center={[0, 20]}
      zoom={2}
      minZoom={2}
      // A full ±180 span crashes MapLibre (maplibre-gl-js#6148), so stay just inside it
      maxBounds={[[-179.9, -85], [179.9, 85]]}
      className="w-full h-full"
    >
      <MapControls position="bottom-right" />

      <ClickHandler onMapClick={onMapClick} />
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
