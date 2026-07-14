import { useState, useCallback, useMemo } from 'react'
import MapView from '../components/Map/MapView'
import StatsBar from '../components/UI/StatsBar'
import AddPinModal from '../components/UI/AddPinModal'
import PlaceSidebar from '../components/Sidebar/PlaceSidebar'

export default function MapPage({
  session,
  places = [],
  photos = [],
  onPlaceCreated,
  onPlaceUpdated,
  onPlaceDeleted,
  onPhotoUploaded,
}) {
  const [selectedPlaceId, setSelectedPlaceId] = useState(null)
  const [pendingPin, setPendingPin] = useState(null)

  const selectedPlace = useMemo(
    () => places.find((p) => p.id === selectedPlaceId) || null,
    [places, selectedPlaceId]
  )

  const photoCount = useMemo(
    () => photos.length,
    [photos]
  )

  // Single click only deselects; double-click opens the add-pin form
  const handleMapClick = useCallback(() => {
    if (selectedPlaceId) setSelectedPlaceId(null)
  }, [selectedPlaceId])

  const handleMapDblClick = useCallback((lat, lng) => {
    setSelectedPlaceId(null)
    setPendingPin({ lat, lng })
  }, [])

  const handlePinClick = useCallback((place) => {
    setSelectedPlaceId(place.id)
    setPendingPin(null)
  }, [])

  const handleCreated = useCallback((place, uploadedPhotos = []) => {
    onPlaceCreated?.(place, uploadedPhotos)
    setPendingPin(null)
    setSelectedPlaceId(place.id)
  }, [onPlaceCreated])

  const handleUpdated = useCallback((updated) => {
    onPlaceUpdated?.(updated)
  }, [onPlaceUpdated])

  const handleDeleted = useCallback((deletedId) => {
    onPlaceDeleted?.(deletedId)
    setSelectedPlaceId(null)
  }, [onPlaceDeleted])

  const handleUploaded = useCallback((photo) => {
    if (!selectedPlace) return
    onPhotoUploaded?.(selectedPlace.id, photo, selectedPlace.name)
  }, [selectedPlace, onPhotoUploaded])

  return (
    <div className="fixed inset-0 pt-12 flex">
      <div className="flex-1 relative">
        <MapView
          places={places}
          onMapClick={handleMapClick}
          onMapDblClick={handleMapDblClick}
          onPinClick={handlePinClick}
          selectedId={selectedPlace?.id}
        />

        <StatsBar places={places} photoCount={photoCount} />

        {places.length === 0 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[900]
                          bg-surface-bg/90 backdrop-blur border border-border rounded-full
                          px-4 py-2 text-sm text-text-muted pointer-events-none shadow-sm">
            Double-click anywhere on the map to drop your first pin 📍
          </div>
        )}
      </div>

      {selectedPlace && (
        <PlaceSidebar
          place={selectedPlace}
          onClose={() => setSelectedPlaceId(null)}
          onPlaceUpdated={handleUpdated}
          onPlaceDeleted={handleDeleted}
          onPhotoUploaded={handleUploaded}
        />
      )}

      {pendingPin && (
        <AddPinModal
          lat={pendingPin.lat}
          lng={pendingPin.lng}
          onClose={() => setPendingPin(null)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}