import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { extractGpsFromFile } from './ExifExtractor'
import { photosApi } from '../../lib/api'

const MAX_SIZE_MB    = 20   // input file size limit
const TARGET_WIDTH   = 1920 // max output width in px
const TARGET_HEIGHT  = 1920 // max output height in px
const JPEG_QUALITY   = 0.78 // 0.0–1.0 — 0.78 gives ~70–80% size reduction with minimal quality loss

/**
 * Compress an image File using the Canvas API.
 * Resizes to fit within TARGET_WIDTH x TARGET_HEIGHT, encodes as JPEG.
 * @param {File} file
 * @returns {Promise<File>} compressed File object
 */
async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      // Calculate output dimensions preserving aspect ratio
      let { width, height } = img
      if (width > TARGET_WIDTH || height > TARGET_HEIGHT) {
        const ratio = Math.min(TARGET_WIDTH / width, TARGET_HEIGHT / height)
        width  = Math.round(width  * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Canvas compression failed')); return }
          const ext          = 'jpg'
          const baseName     = file.name.replace(/\.[^.]+$/, '')
          const compressedFile = new File([blob], `${baseName}.${ext}`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          })
          resolve(compressedFile)
        },
        'image/jpeg',
        JPEG_QUALITY
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image for compression'))
    }

    img.src = url
  })
}

function formatBytes(bytes) {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * @param {string}   placeId      — place to attach photos to
 * @param {function} onUploaded   — called with the uploaded photo object
 * @param {function} onGpsFound   — called with {lat, lng} from first EXIF-tagged photo
 */
export default function PhotoUploader({ placeId, onUploaded, onGpsFound }) {
  const [previews,  setPreviews]  = useState([])
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles.length) return

    // Build initial preview list with 'compressing' status
    const items = acceptedFiles.map((f) => ({
      file:     f,
      url:      URL.createObjectURL(f),
      status:   'compressing',
      origSize: f.size,
      compSize: null,
      error:    null,
    }))
    setPreviews((prev) => [...prev, ...items])

    // Extract GPS from first file that has it (before compression)
    for (const item of items) {
      const gps = await extractGpsFromFile(item.file)
      if (gps && onGpsFound) { onGpsFound(gps); break }
    }

    // Compress then upload each file
    if (!placeId) return
    setUploading(true)

    for (const item of items) {
      // ── Compress ────────────────────────────────────────────
      let fileToUpload = item.file
      try {
        const compressed = await compressImage(item.file)
        fileToUpload = compressed
        setPreviews((prev) =>
          prev.map((p) =>
            p.url === item.url
              ? { ...p, status: 'uploading', compSize: compressed.size }
              : p
          )
        )
      } catch {
        // Compression failed — fall back to original file
        setPreviews((prev) =>
          prev.map((p) =>
            p.url === item.url ? { ...p, status: 'uploading', compSize: item.file.size } : p
          )
        )
      }

      // ── Upload ──────────────────────────────────────────────
      try {
        const photo = await photosApi.upload(fileToUpload, placeId)
        setPreviews((prev) =>
          prev.map((p) => (p.url === item.url ? { ...p, status: 'done' } : p))
        )
        onUploaded?.(photo)
      } catch (err) {
        setPreviews((prev) =>
          prev.map((p) =>
            p.url === item.url ? { ...p, status: 'error', error: err.message } : p
          )
        )
      }
    }

    setUploading(false)
  }, [placeId, onUploaded, onGpsFound])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic'] },
    maxSize: MAX_SIZE_MB * 1024 * 1024,
    multiple: true,
  })

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-colors duration-150
          ${isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/60 bg-surface'}
        `}
      >
        <input {...getInputProps()} />
        <svg className="mx-auto mb-2 text-text-muted" width="28" height="28"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p className="text-sm text-text-muted">
          {isDragActive ? 'Drop photos here…' : 'Drag & drop photos, or click to select'}
        </p>
        <p className="text-xs text-text-faint mt-1">
          Auto-compressed to 1920px · JPG, PNG, WebP, HEIC · max {MAX_SIZE_MB} MB each
        </p>
      </div>

      {/* Previews */}
      {previews.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {previews.map((item) => (
            <div
              key={item.url}
              className="relative rounded-md overflow-hidden aspect-square bg-surface-offset"
            >
              <img
                src={item.url}
                alt=""
                loading="lazy"
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />

              {/* Compressing */}
              {item.status === 'compressing' && (
                <div className="absolute inset-0 bg-white/70 flex flex-col items-center justify-center gap-1">
                  <Spinner />
                  <span className="text-xs text-text-muted">Compressing</span>
                </div>
              )}

              {/* Uploading */}
              {item.status === 'uploading' && (
                <div className="absolute inset-0 bg-white/70 flex flex-col items-center justify-center gap-1">
                  <Spinner />
                  <span className="text-xs text-text-muted">Uploading</span>
                </div>
              )}

              {/* Done — show size reduction badge */}
              {item.status === 'done' && item.compSize && (
                <div className="absolute bottom-0 inset-x-0 bg-black/50 px-1 py-0.5 flex items-center justify-between">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
                    stroke="#4ade80" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span className="text-white" style={{ fontSize: '8px' }}>
                    {formatBytes(item.origSize)} → {formatBytes(item.compSize)}
                  </span>
                </div>
              )}

              {/* Error */}
              {item.status === 'error' && (
                <div className="absolute inset-0 bg-red-50/80 flex items-center justify-center p-1">
                  <span className="text-xs text-red-600 text-center">{item.error}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin text-primary" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
    </svg>
  )
}