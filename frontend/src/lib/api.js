/**
 * api.js — Typed wrappers around the Pintrip FastAPI backend.
 * All requests attach the Supabase JWT so the backend can identify the user.
 */
import { getAuthHeader } from './supabase'

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
   * Upload a single File object to a place.
   * @param {File}   file
   * @param {string} placeId
   */
  upload: async (file, placeId) => {
    const form = new FormData()
    form.append('file',     file)
    form.append('place_id', placeId)
    return request('POST', '/photos/upload', form)
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
   * Generate a travel story from all photo captions for a place.
   * @param {string} placeId
   */
  story: (placeId) =>
    request('POST', '/ai/story', { place_id: placeId }),
}
