import { Link } from 'react-router-dom'

export default function GalleryPage({ photos = [], loading = false }) {
  return (
    <main className="pt-16 px-4 pb-8 max-w-[1200px] mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-xl text-text">Gallery</h1>
        <p className="text-sm text-text-muted mt-0.5">
          {loading ? 'Loading…' : `${photos.length} photo${photos.length !== 1 ? 's' : ''} across all your trips`}
        </p>
      </div>

      {loading && (
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="skeleton mb-3 break-inside-avoid rounded-lg"
              style={{ height: `${140 + (i % 3) * 60}px` }}
            />
          ))}
        </div>
      )}

      {!loading && photos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <svg className="text-text-faint mb-4" width="48" height="48" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <h3 className="text-base font-medium text-text mb-1">No photos yet</h3>
          <p className="text-sm text-text-muted mb-4 max-w-xs">
            Pin a place on the map and upload your travel photos to see them here.
          </p>
          <Link
            to="/"
            className="rounded-md bg-primary text-white px-4 py-2 text-sm font-medium
                       hover:bg-primary-hover transition-colors no-underline"
          >
            Go to Map
          </Link>
        </div>
      )}

      {!loading && photos.length > 0 && (
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="mb-3 break-inside-avoid group relative rounded-lg overflow-hidden shadow-sm"
            >
              <img
                src={photo.signed_url || photo.public_url}
                alt={photo.ai_caption || photo.placeName}
                loading="lazy"
                width={300}
                height={200}
                className="w-full h-auto block"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent
                              opacity-0 group-hover:opacity-100 transition-opacity flex flex-col
                              justify-end p-3">
                <p className="text-white text-xs font-medium">{photo.placeName}</p>
                {photo.ai_caption && (
                  <p className="text-white/80 text-xs mt-0.5 line-clamp-2">{photo.ai_caption}</p>
                )}
                {photo.ai_tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {photo.ai_tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-white/20 text-white rounded-full px-1.5 py-0.5"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}