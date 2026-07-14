/**
 * api.js — Typed wrappers around the Pintrip FastAPI backend.
 * All requests attach the Supabase JWT so the backend can identify the user.
 */
import { getAuthHeader } from './auth'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function request(method, path, body) {
  const authHeaders = await getAuthHeader()
  const isFormData  = body instanceof FormData

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...authHeaders,
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `API error ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// ── Places ────────────────────────────────────────────────────────────────────
export const placesApi = {
  list:   ()          => request('GET',    '/places/'),
  get:    (id)        => request('GET',    `/places/${id}`),
  create: (data)      => request('POST',   '/places/', data),
  update: (id, data)  => request('PUT',    `/places/${id}`, data),
  delete: (id)        => request('DELETE', `/places/${id}`),
}

// ── Photos ────────────────────────────────────────────────────────────────────
export const photosApi = {
  list:   (placeId)   => request('GET', `/photos/${placeId}`),
  delete: (photoId)   => request('DELETE', `/photos/${photoId}`),

  /**
   * Upload a single File object to a place via a presigned S3 PUT — the file
   * goes straight from the browser to S3, bypassing the backend entirely.
   * @param {File}   file
   * @param {string} placeId
   */
  upload: async (file, placeId) => {
    const { upload_url, storage_path } = await request('POST', '/photos/presign', {
      filename: file.name,
      content_type: file.type || 'application/octet-stream',
      place_id: placeId,
    })

    const putRes = await fetch(upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    })
    if (!putRes.ok) throw new Error('Upload to storage failed')

    return request('POST', '/photos/confirm', { storage_path, place_id: placeId })
  },
}

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiApi = {
  /**
   * Generate a caption + tags for a photo by URL.
   * @param {string} imageUrl
   * @param {string} [photoId]  — optional, persists caption to DB
   */
  caption: (imageUrl, photoId) =>
    request('POST', '/ai/caption', { image_url: imageUrl, photo_id: photoId }),

  /**
   * Generate a meaningful, philosophical caption for a place from its cover
   * photo + name, country, notes and tags.
   * @param {string} placeId
   */
  placeCaption: (placeId) =>
    request('POST', '/ai/place-caption', { place_id: placeId }),

  /**
   * The user's full travel profile (places, photos, tags, captions, stats) —
   * the same context the chat bot is personalized with.
   */
  context: () => request('GET', '/ai/context'),
}
