import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthPage() {
  const [mode,     setMode]     = useState('signin')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [message,  setMessage]  = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError(null); setMessage(null)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Check your email for a confirmation link.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <svg width="52" height="52" viewBox="0 0 48 48" fill="none" aria-label="Pintrip">
            <circle cx="24" cy="20" r="13" fill="#01696f"/>
            <circle cx="24" cy="20" r="7"  fill="#fff"/>
            <circle cx="24" cy="20" r="3"  fill="#01696f"/>
            <path d="M24 33 L24 46" stroke="#01696f" strokeWidth="3" strokeLinecap="round"/>
            <ellipse cx="24" cy="46" rx="6" ry="2" fill="#cedcd8"/>
          </svg>
          <h1 className="font-display text-2xl text-text mt-3">Pintrip</h1>
          <p className="text-sm text-text-muted mt-1">Your travel photo map</p>
        </div>

        <div className="bg-surface rounded-xl border border-border shadow-md p-6">
          <h2 className="text-base font-medium text-text mb-4">
            {mode === 'signin' ? 'Sign in to your account' : 'Create an account'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Email</label>
              <input type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-md border border-border bg-surface-bg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
                           placeholder:text-text-faint transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Password</label>
              <input type="password" required minLength={6} value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-border bg-surface-bg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
                           placeholder:text-text-faint transition-colors" />
            </div>
            {error   && <p className="text-xs text-red-600">{error}</p>}
            {message && <p className="text-xs text-primary">{message}</p>}
            <button type="submit" disabled={loading}
              className="w-full rounded-md bg-primary text-white py-2 text-sm font-medium
                         hover:bg-primary-hover disabled:opacity-50 transition-colors mt-1">
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
          <p className="text-xs text-text-muted text-center mt-4">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}
              className="text-primary hover:underline font-medium">
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
