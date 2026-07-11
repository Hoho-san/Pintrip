const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const SESSION_KEY = 'pintrip_session'

function storeSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export function getStoredSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY))
  } catch {
    return null
  }
}

export async function getAuthHeader() {
  const session = getStoredSession()
  if (!session?.access_token) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const authApi = {
  async signUp({ email, password }) {
    const session = await post('/auth/register', { email, password })
    storeSession(session)
    return session
  },

  async signIn({ email, password }) {
    const session = await post('/auth/login', { email, password })
    storeSession(session)
    return session
  },

  signOut() {
    clearSession()
  },

  getSession() {
    return getStoredSession()
  },
}
