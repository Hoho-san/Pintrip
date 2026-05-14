import { createContext, useContext, useState, useEffect } from 'react'

const AppContext = createContext()

export function AppProvider({ children }) {
  const [theme, setTheme] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  )

  const [markerStyle, setMarkerStyle] = useState('photo') // 'photo' | 'pin' | 'flag'

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
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