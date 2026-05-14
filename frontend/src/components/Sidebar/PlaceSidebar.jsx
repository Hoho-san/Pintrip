/**
 * PlaceSidebar.jsx
 * Slides in when a pin is clicked. Shows:
 *  - Cover photo, place name, date, tags
 *  - Journal notes
 *  - AI caption for cover photo
 *  - Photo grid for the place
 *  - Photo upload area
 *  - AI story button
 *  - Delete pin button
 */
import { useEffect, useState, useCallback } from 'react'
import { photosApi, aiApi, placesApi } from '../../lib/api'
import PhotoUploader from '../Upload/PhotoUploader'

export default function PlaceSidebar({ place, onClose, onPlaceUpdated, onPlaceDeleted, onPhotoUploaded }) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [story, setStory] = useState(null)
  const [genStory, setGenStory] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [tab, setTab] = useState('photos')

  useEffect(() => {
    if (!place) return
    setLoading(true)
    setPhotos([])
    setStory(null)
    setTab('photos')
    photosApi.list(place.id)
      .then(setPhotos)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [place?.id])

  const handleUploaded = useCallback(async (photo) => {
    setPhotos((prev) => [photo, ...prev])
    onPhotoUploaded?.(photo)

    if (!place.cover_photo) {
      placesApi.update(place.id, { cover_photo: photo.storage_path })
        .then((updated) => onPlaceUpdated?.(updated))
        .catch(console.error)
    }

    const imageUrl = photo.signed_url || photo.public_url
    if (!imageUrl || !photo.id) return

    try {
      const res = await aiApi.caption(imageUrl, photo.id)
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photo.id
            ? { ...p, ai_caption: res.caption, ai_tags: res.tags }
            : p
        )
      )
    } catch (err) {
      console.error('Caption generation failed:', err)
    }
  }, [place, onPlaceUpdated, onPhotoUploaded])

  const handleDeletePlace = async () => {
    const confirmed = window.confirm(
      `Delete "${place.name}" and all its photos? This cannot be undone.`
    )
    if (!confirmed) return

    setDeleting(true)
    try {
      await placesApi.delete(place.id)
      onPlaceDeleted?.(place.id)
    } catch (err) {
      console.error(err)
      alert(err.message || 'Failed to delete place')
      setDeleting(false)
    }
  }

  const generateStory = async () => {
    setGenStory(true)
    setStory(null)
    try {
      const res = await aiApi.story(place.id)
      setStory(res.story)
      setTab('story')
    } catch (err) {
      console.error('Story failed:', err)
      setStory('Could not generate story. Try uploading more photos first.')
    } finally {
      setGenStory(false)
    }
  }

  if (!place) return null

  const coverPhoto =
    place.cover_signed_url ||
    photos[0]?.signed_url ||
    place.cover_photo ||
    photos[0]?.public_url

  return (
    <aside className="
      fixed right-0 top-12 bottom-0 w-80 bg-surface-bg border-l border-border z-[800]
      flex flex-col overflow-hidden shadow-lg animate-fadein
    ">
      <div className="relative h-44 bg-surface-offset flex-shrink-0">
        {coverPhoto ? (
          <img
            src={coverPhoto}
            alt={place.name}
            loading="lazy"
            width={320}
            height={176}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-faint">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}

        <button
          onClick={onClose}
          aria-label="Close sidebar"
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 text-white
                     flex items-center justify-center hover:bg-black/60 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="px-4 pt-3 pb-2 flex-shrink-0">
        <h2 className="font-display text-xl text-text leading-tight">{place.name}</h2>
        <p className="text-xs text-text-muted mt-0.5">
          {[place.country, place.visited_at].filter(Boolean).join(' · ')}
        </p>
        {place.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {place.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex border-b border-border px-4 flex-shrink-0">
        {['photos', 'notes', 'story'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`
              py-2 px-3 text-xs font-medium capitalize transition-colors border-b-2 -mb-px
              ${tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text'}
            `}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {tab === 'photos' && (
          <div className="space-y-3">
            <PhotoUploader placeId={place.id} onUploaded={handleUploaded} />

            {loading && (
              <div className="grid grid-cols-3 gap-1.5">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="skeleton aspect-square rounded-md" />
                ))}
              </div>
            )}

            {!loading && photos.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative rounded-md overflow-hidden aspect-square group"
                  >
                    <img
                      src={photo.signed_url || photo.public_url}
                      alt={photo.ai_caption || ''}
                      loading="lazy"
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                    {photo.ai_caption && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100
                                      transition-opacity flex items-end p-1.5">
                        <p className="text-white text-xs line-clamp-3">{photo.ai_caption}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!loading && photos.length === 0 && (
              <p className="text-xs text-text-faint text-center py-4">
                No photos yet — upload your first one above.
              </p>
            )}
          </div>
        )}

        {tab === 'notes' && (
          <div>
            {place.notes
              ? <p className="text-sm text-text whitespace-pre-wrap leading-relaxed">{place.notes}</p>
              : <p className="text-xs text-text-faint">No journal notes for this place.</p>}
          </div>
        )}

        {tab === 'story' && (
          <div className="space-y-3">
            {story ? (
              <p className="text-sm text-text italic leading-relaxed">{story}</p>
            ) : (
              <p className="text-xs text-text-muted">
                Generate an AI travel diary entry from your photo captions.
              </p>
            )}
            <button
              onClick={generateStory}
              disabled={genStory || photos.length === 0}
              className="w-full rounded-md bg-primary text-white py-2 text-sm font-medium
                         hover:bg-primary-hover disabled:opacity-40 transition-colors
                         flex items-center justify-center gap-2"
            >
              {genStory ? <><Spinner /> Generating…</> : '✨ Generate Travel Story'}
            </button>
            {photos.length === 0 && (
              <p className="text-xs text-text-faint text-center">
                Upload photos first to generate a story.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="px-4 pb-4 pt-3 border-t border-border flex-shrink-0">
        <button
          onClick={handleDeletePlace}
          disabled={deleting}
          className="w-full rounded-md border border-red-200 text-red-600 py-2 text-sm
                     font-medium hover:bg-red-50 disabled:opacity-50 transition-colors
                     flex items-center justify-center gap-2"
        >
          {deleting ? (
            <><Spinner /> Deleting…</>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
              Delete Pin
            </>
          )}
        </button>
      </div>
    </aside>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
    </svg>
  )
}