import { createContext, useContext, useState, useEffect } from 'react'

const AppContext = createContext()

export function AppProvider({ children }) {
  const [theme, setTheme] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  )

  const [markerStyle, setMarkerStyle] = useState('flag') // change this

  useEffect(() => {
    const root = document.documentElement
    // Keep an explicit class for BOTH themes: the mapcn Map watches these and
    // ignores "no class at all", so only removing 'dark' leaves the map dark.
    root.classList.toggle('dark', theme === 'dark')
    root.classList.toggle('light', theme !== 'dark')
  }, [theme])

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return (
    <AppContext.Provider value={{ theme, toggle, markerStyle, setMarkerStyle }}>
      {children}
    </AppContext.Provider>
  )
}

export const useTheme = () => useContext(AppContext)
export const useAppContext = () => useContext(AppContext)