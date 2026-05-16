/**
 * AddPinModal.jsx
 * Opens when the user clicks an empty spot on the map.
 * Accepts place name, date visited, notes, tags.
 * Photo upload is handled after the place is created.
 */
import { useState, useEffect } from 'react'
import { placesApi } from '../../lib/api'

export default function AddPinModal({ lat, lng, onClose, onCreated, initialDate }) {
  const [form, setForm] = useState({
    name:       '',
    country:    '',
    visited_at: initialDate || '',
    notes:      '',
    tags:       '',
  })
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)

  // Check if user has typed anything
  const isDirty = form.name || form.country || form.notes || form.tags || form.visited_at

  function handleAttemptClose() {
    if (isDirty) {
      setShowConfirm(true)
    } else {
      onClose()
    }
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (showConfirm) {
          setShowConfirm(false) // dismiss confirm dialog first
        } else {
          handleAttemptClose()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, isDirty, showConfirm])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Place name is required'); return }
    setSaving(true)
    setError(null)
    try {
      const tags = form.tags
        ? form.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : []
      const place = await placesApi.create({
        name:       form.name.trim(),
        country:    form.country.trim() || null,
        lat,
        lng,
        visited_at: form.visited_at || null,
        notes:      form.notes.trim() || null,
        tags,
      })
      onCreated(place)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const field = (label, name, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-medium text-text-muted mb-1">{label}</label>
      <input
        type={type}
        value={form[name]}
        onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text
                   focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
                   placeholder:text-text-faint transition-colors"
      />
    </div>
  )

  return (
    <>
      {/* Main Modal */}
      <div
        className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) handleAttemptClose() }}
      >
        <div className="bg-surface-bg rounded-xl shadow-lg w-full max-w-sm animate-fadein">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-display text-lg text-text">Pin a Place</h2>
            <button onClick={handleAttemptClose} aria-label="Close" className="text-text-muted hover:text-text transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6"  x2="6"  y2="18"/>
                <line x1="6"  y1="6"  x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Coords badge */}
          <div className="px-5 pt-3">
            <span className="text-xs text-text-faint font-mono bg-surface-offset rounded px-2 py-0.5">
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
            {field('Place name *', 'name', 'text', 'e.g. Kyoto Old Town')}
            {field('Country',      'country', 'text', 'e.g. Japan')}
            {field('Date visited', 'visited_at', 'date')}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Notes</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="What did you experience here?"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text
                           focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
                           placeholder:text-text-faint resize-none transition-colors"
              />
            </div>
            {field('Tags', 'tags', 'text', 'beach, food, architecture (comma-separated)')}

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={handleAttemptClose}
                className="flex-1 rounded-md border border-border py-2 text-sm text-text-muted
                           hover:bg-surface-offset transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 rounded-md bg-primary text-white py-2 text-sm font-medium
                           hover:bg-primary-hover disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : 'Add Pin'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Confirm Discard Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface-bg rounded-xl shadow-xl w-full max-w-xs p-6 animate-fadein">
            <h3 className="font-display text-base text-text mb-2">Discard changes?</h3>
            <p className="text-sm text-text-muted mb-5">
              You have unsaved information. If you leave now, your input will be lost.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-md border border-border py-2 text-sm text-text-muted
                           hover:bg-surface-offset transition-colors"
              >
                Keep editing
              </button>
              <button
                onClick={onClose}
                className="flex-1 rounded-md bg-red-500 text-white py-2 text-sm font-medium
                           hover:bg-red-600 transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}