import { useEffect, useRef, useState } from 'react'
import { authApi } from '../lib/auth'

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY
const GOOGLE_CLIENT_ID   = import.meta.env.VITE_GOOGLE_CLIENT_ID

export default function AuthPage({ onSignIn }) {
  const [mode,     setMode]     = useState('signin')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [message,  setMessage]  = useState(null)
  const [captchaToken, setCaptchaToken] = useState(null)

  const turnstileRef = useRef(null)
  const widgetId     = useRef(null)
  const googleBtnRef = useRef(null)

  // Render the Turnstile widget when switching into signup mode
  useEffect(() => {
    if (mode !== 'signup' || !TURNSTILE_SITE_KEY) return

    let cancelled = false
    function renderWidget() {
      if (cancelled || !turnstileRef.current || !window.turnstile) return
      widgetId.current = window.turnstile.render(turnstileRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token) => setCaptchaToken(token),
        'expired-callback': () => setCaptchaToken(null),
      })
    }

    if (window.turnstile) {
      renderWidget()
    } else {
      const interval = setInterval(() => {
        if (window.turnstile) { clearInterval(interval); renderWidget() }
      }, 100)
      return () => { cancelled = true; clearInterval(interval) }
    }

    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
      widgetId.current = null
      setCaptchaToken(null)
    }
  }, [mode])

  // Initialize Google Identity Services and render the "Continue with Google"
  // button. The GSI script loads async, so poll for window.google (same pattern
  // as the Turnstile widget above). Works for both signin and signup modes.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return

    let cancelled = false
    function init() {
      if (cancelled || !googleBtnRef.current || !window.google) return
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          setError(null); setLoading(true)
          try {
            const session = await authApi.signInWithGoogle(credential)
            onSignIn(session)
          } catch (err) {
            setError(err.message)
          } finally {
            setLoading(false)
          }
        },
      })
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline', size: 'large', width: 320, text: 'continue_with',
      })
    }

    if (window.google) {
      init()
    } else {
      const interval = setInterval(() => {
        if (window.google) { clearInterval(interval); init() }
      }, 100)
      return () => { cancelled = true; clearInterval(interval) }
    }
    return () => { cancelled = true }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError(null); setMessage(null)
    try {
      if (mode === 'signup') {
        const session = await authApi.signUp({ email, password, turnstileToken: captchaToken })
        onSignIn(session)
      } else {
        const session = await authApi.signIn({ email, password })
        onSignIn(session)
      }
    } catch (err) {
      setError(err.message)
      if (mode === 'signup' && window.turnstile && widgetId.current) {
        window.turnstile.reset(widgetId.current)
        setCaptchaToken(null)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-bg dark:bg-dark-bg flex items-center justify-center p-4 transition-colors duration-200">
      <div className="w-full max-w-sm">

        {/* Logo + title */}
        <div className="flex flex-col items-center mb-8">
          <svg width="52" height="52" viewBox="0 0 48 48" fill="none" aria-label="Pintrip">
            <circle cx="24" cy="20" r="13" fill="#01696f"/>
            <circle cx="24" cy="20" r="7"  fill="#fff"/>
            <circle cx="24" cy="20" r="3"  fill="#01696f"/>
            <path d="M24 33 L24 46" stroke="#01696f" strokeWidth="3" strokeLinecap="round"/>
            <ellipse cx="24" cy="46" rx="6" ry="2" fill="#cedcd8"/>
          </svg>
          <h1 className="font-display text-2xl text-text dark:text-dark-text mt-3">Pintrip</h1>
          <p className="text-sm text-text-muted dark:text-dark-muted mt-1">Your travel photo map</p>
        </div>

        {/* Card */}
        <div className="bg-surface dark:bg-dark-surface rounded-xl border border-border dark:border-dark-border shadow-md p-6">
          <h2 className="text-base font-medium text-text dark:text-dark-text mb-4">
            {mode === 'signin' ? 'Sign in to your account' : 'Create an account'}
          </h2>

          {/* Continue with Google */}
          {GOOGLE_CLIENT_ID && (
            <>
              <div ref={googleBtnRef} className="flex justify-center mb-4" />
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-border dark:bg-dark-border" />
                <span className="text-xs text-text-muted dark:text-dark-muted">or</span>
                <div className="h-px flex-1 bg-border dark:bg-dark-border" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-text-muted dark:text-dark-muted mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-md border border-border dark:border-dark-border
                           bg-surface-bg dark:bg-dark-bg
                           text-text dark:text-dark-text
                           px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary/40 dark:focus:ring-dark-primary/40
                           focus:border-primary dark:focus:border-dark-primary
                           placeholder:text-text-faint dark:placeholder:text-dark-faint
                           transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-text-muted dark:text-dark-muted mb-1">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-border dark:border-dark-border
                           bg-surface-bg dark:bg-dark-bg
                           text-text dark:text-dark-text
                           px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary/40 dark:focus:ring-dark-primary/40
                           focus:border-primary dark:focus:border-dark-primary
                           placeholder:text-text-faint dark:placeholder:text-dark-faint
                           transition-colors"
              />
            </div>

            {/* Turnstile CAPTCHA (signup only) */}
            {mode === 'signup' && TURNSTILE_SITE_KEY && (
              <div ref={turnstileRef} />
            )}

            {/* Feedback messages */}
            {error   && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
            {message && <p className="text-xs text-primary dark:text-dark-primary">{message}</p>}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || (mode === 'signup' && !!TURNSTILE_SITE_KEY && !captchaToken)}
              className="w-full rounded-md bg-primary dark:bg-dark-primary
                         hover:bg-primary-hover dark:hover:bg-dark-primary-hover
                         text-white py-2 text-sm font-medium
                         disabled:opacity-50 transition-colors mt-1"
            >
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Mode switcher */}
          <p className="text-xs text-text-muted dark:text-dark-muted text-center mt-4">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}
              className="text-primary dark:text-dark-primary hover:underline font-medium"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>

      </div>
    </div>
  )
}
