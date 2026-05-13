import { useState, useEffect, useCallback } from 'react'
import MapView from '../components/Map/MapView'
import StatsBar from '../components/UI/StatsBar'
import AddPinModal from '../components/UI/AddPinModal'
import PlaceSidebar from '../components/Sidebar/PlaceSidebar'
import { placesApi, photosApi } from '../lib/api'

export default function MapPage({ session }) {
  const [places, setPlaces] = useState([])
  const [photoCount, setPhotoCount] = useState(0)
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [pendingPin, setPendingPin] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const placesData = await placesApi.list()

        const placesWithCounts = await Promise.all(
          placesData.map(async (place) => {
            const photos = await photosApi.list(place.id)
            return {
              ...place,
              photo_count: photos.length,
            }
          })
        )

        setPlaces(placesWithCounts)
        setPhotoCount(
          placesWithCounts.reduce((sum, place) => sum + (place.photo_count || 0), 0)
        )
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleMapClick = useCallback((lat, lng) => {
    if (selectedPlace) {
      setSelectedPlace(null)
      return
    }
    setPendingPin({ lat, lng })
  }, [selectedPlace])

  const handlePinClick = useCallback((place) => {
    setSelectedPlace(place)
    setPendingPin(null)
  }, [])

  const handlePlaceCreated = useCallback((place) => {
    const newPlace = { ...place, photo_count: 0 }
    setPlaces((prev) => [newPlace, ...prev])
    setPendingPin(null)
    setSelectedPlace(newPlace)
  }, [])

  const handlePlaceUpdated = useCallback((updated) => {
    setPlaces((prev) =>
      prev.map((p) =>
        p.id === updated.id
          ? { ...p, ...updated, photo_count: p.photo_count || 0 }
          : p
      )
    )
    if (selectedPlace?.id === updated.id) {
      setSelectedPlace((prev) => ({
        ...prev,
        ...updated,
        photo_count: prev?.photo_count || 0,
      }))
    }
  }, [selectedPlace])

  const handlePlaceDeleted = useCallback((deletedId) => {
    const deletedPlace = places.find((p) => p.id === deletedId)
    const deletedPhotoCount = deletedPlace?.photo_count || 0

    setPlaces((prev) => prev.filter((p) => p.id !== deletedId))
    setPhotoCount((prev) => Math.max(0, prev - deletedPhotoCount))
    setSelectedPlace(null)
  }, [places])

  const handlePhotoUploaded = useCallback(() => {
    if (!selectedPlace) return

    setPlaces((prev) =>
      prev.map((p) =>
        p.id === selectedPlace.id
          ? { ...p, photo_count: (p.photo_count || 0) + 1 }
          : p
      )
    )

    setSelectedPlace((prev) =>
      prev
        ? { ...prev, photo_count: (prev.photo_count || 0) + 1 }
        : prev
    )

    setPhotoCount((prev) => prev + 1)
  }, [selectedPlace])

  return (
    <div className="fixed inset-0 pt-12 flex">
      <div className="flex-1 relative">
        {!loading && (
          <MapView
            places={places}
            onMapClick={handleMapClick}
            onPinClick={handlePinClick}
            selectedId={selectedPlace?.id}
          />
        )}

        <StatsBar places={places} photoCount={photoCount} />

        {!loading && places.length === 0 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[900]
                          bg-surface-bg/90 backdrop-blur border border-border rounded-full
                          px-4 py-2 text-sm text-text-muted pointer-events-none shadow-sm">
            Click anywhere on the map to drop your first pin 📍
          </div>
        )}
      </div>

      {selectedPlace && (
        <PlaceSidebar
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
          onPlaceUpdated={handlePlaceUpdated}
          onPlaceDeleted={handlePlaceDeleted}
          onPhotoUploaded={handlePhotoUploaded}
        />
      )}

      {pendingPin && (
        <AddPinModal
          lat={pendingPin.lat}
          lng={pendingPin.lng}
          onClose={() => setPendingPin(null)}
          onCreated={handlePlaceCreated}
        />
      )}
    </div>
  )
}