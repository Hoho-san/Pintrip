import { useEffect } from 'react'
import { MapContainer, TileLayer, useMapEvents, useMap } from 'react-leaflet'
import PhotoPin from './PhotoPin'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => onMapClick(e.latlng.lat, e.latlng.lng),
  })
  return null
}

function AutoFocusCountry({ places = [] }) {
  const map = useMap()

  useEffect(() => {
    if (!places.length) return

    // Group places by country and sum photo counts
    const grouped = places.reduce((acc, place) => {
      const country = place.country || 'Unknown'
      if (!acc[country]) {
        acc[country] = {
          photoCount: 0,
          coords: [],
        }
      }
      acc[country].photoCount += place.photo_count || 0
      acc[country].coords.push([place.lat, place.lng])
      return acc
    }, {})

    // Find country with most photos
    const topCountry = Object.values(grouped).sort((a, b) => b.photoCount - a.photoCount)[0]
    if (!topCountry || !topCountry.coords.length) return

    // If all countries have 0 photos, fall back to all markers
    const coordsToUse =
      topCountry.photoCount > 0
        ? topCountry.coords
        : places.map((p) => [p.lat, p.lng])

    if (coordsToUse.length === 1) {
      map.flyTo(coordsToUse[0], 6, { duration: 1.2 })
      return
    }

    const bounds = L.latLngBounds(coordsToUse)
    map.fitBounds(bounds, {
      padding: [48, 48],
      maxZoom: 6,
    })
  }, [places, map])

  return null
}

export default function MapView({ places = [], onMapClick, onPinClick, selectedId }) {
  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      minZoom={2}
      maxBounds={[[-90, -180], [90, 180]]}
      maxBoundsViscosity={1.0}
      className="w-full h-full"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <ClickHandler onMapClick={onMapClick} />
      <AutoFocusCountry places={places} />

      {places.map((place) => (
        <PhotoPin
          key={place.id}
          place={place}
          isSelected={place.id === selectedId}
          onClick={() => onPinClick(place)}
        />
      ))}
    </MapContainer>
  )
}