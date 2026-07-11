import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from './lib/supabase'
import { placesApi, photosApi } from './lib/api'
import MapPage from './pages/MapPage'
import GalleryPage from './pages/GalleryPage'
import AuthPage from './pages/AuthPage'
import NavBar from './components/UI/NavBar'
import AiChatBot from './components/AI/AiChatBot'  // ← ADD THIS

export default function App() {
  const [session, setSession] = useState(undefined)
  const [places, setPlaces] = useState([])
  const [photos, setPhotos] = useState([])
  const [appLoading, setAppLoading] = useState(true)
  const initialLoadDone = useRef(false)

  // Supabase emits a fresh session object on every token refresh (e.g. when
  // the tab regains focus), so effects must key on the user id, not the
  // session object, or they re-run on every refresh.
  const userId = session?.user?.id

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadAppData = useCallback(async () => {
    if (!userId) {
      setPlaces([])
      setPhotos([])
      setAppLoading(false)
      initialLoadDone.current = false
      return
    }

    setAppLoading(true)
    try {
      const placesData = await placesApi.list()

      const photoGroups = await Promise.all(
        placesData.map(async (place) => {
          const placePhotos = await photosApi.list(place.id)
          return placePhotos.map((photo) => ({
            ...photo,
            placeId: place.id,
            placeName: place.name,
          }))
        })
      )

      const flatPhotos = photoGroups.flat()

      const placesWithCounts = placesData.map((place) => ({
        ...place,
        photo_count: flatPhotos.filter((photo) => photo.placeId === place.id).length,
      }))

      setPlaces(placesWithCounts)
      setPhotos(
        flatPhotos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      )
    } catch (err) {
      console.error(err)
    } finally {
      setAppLoading(false)
      initialLoadDone.current = true
    }
  }, [userId])

  useEffect(() => {
    loadAppData()
  }, [loadAppData])

  const handlePlaceCreated = useCallback((place) => {
    const newPlace = { ...place, photo_count: 0 }
    setPlaces((prev) => [newPlace, ...prev])
  }, [])

  const handlePlaceUpdated = useCallback((updated) => {
    setPlaces((prev) =>
      prev.map((p) =>
        p.id === updated.id
          ? { ...p, ...updated, photo_count: p.photo_count || 0 }
          : p
      )
    )
  }, [])

  const handlePlaceDeleted = useCallback((deletedId) => {
    setPlaces((prev) => prev.filter((p) => p.id !== deletedId))
    setPhotos((prev) => prev.filter((p) => p.placeId !== deletedId))
  }, [])

  const handlePhotoUploaded = useCallback((placeId, photo, placeName) => {
    const enrichedPhoto = {
      ...photo,
      placeId,
      placeName,
    }

    setPhotos((prev) =>
      [enrichedPhoto, ...prev].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    )

    setPlaces((prev) =>
      prev.map((p) =>
        p.id === placeId
          ? { ...p, photo_count: (p.photo_count || 0) + 1 }
          : p
      )
    )
  }, [])

  if (session === undefined || (session && appLoading && !initialLoadDone.current)) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-bg dark:bg-dark-bg">
        <div className="flex flex-col items-center gap-3">
          <PintripLogo />
          <p className="text-sm text-text-muted dark:text-dark-muted">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {session && <NavBar session={session} />}
      <Routes>
        <Route
          path="/auth"
          element={session ? <Navigate to="/" /> : <AuthPage />}
        />

        <Route
          path="/"
          element={
            session ? (
              <MapPage
                session={session}
                places={places}
                photos={photos}
                onPlaceCreated={handlePlaceCreated}
                onPlaceUpdated={handlePlaceUpdated}
                onPlaceDeleted={handlePlaceDeleted}
                onPhotoUploaded={handlePhotoUploaded}
              />
            ) : (
              <Navigate to="/auth" />
            )
          }
        />

        <Route
          path="/gallery"
          element={
            session ? (
              <GalleryPage
                photos={photos}
                loading={appLoading}
              />
            ) : (
              <Navigate to="/auth" />
            )
          }
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      {session && <AiChatBot />}  {/* ← ADD THIS */}
    </>
  )
}

function PintripLogo() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-label="Pintrip logo">
      <circle cx="24" cy="20" r="13" fill="#01696f" />
      <circle cx="24" cy="20" r="7" fill="#fff" />
      <circle cx="24" cy="20" r="3" fill="#01696f" />
      <path d="M24 33 L24 46" stroke="#01696f" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="24" cy="46" rx="6" ry="2" fill="#cedcd8" />
    </svg>
  )
}