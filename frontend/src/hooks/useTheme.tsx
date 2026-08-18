import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

import { updateUserSettings } from '../services/auth'

export type ThemeName = 'teal' | 'ocean' | 'forest' | 'sunset' | 'purple'

export interface Theme {
  id: ThemeName
  name: string
  colors: {
    primary: string
  }
}

export const AVAILABLE_THEMES: Theme[] = [
  {
    id: 'teal',
    name: 'Modern Teal',
    colors: { primary: '#10a878' },
  },
  {
    id: 'ocean',
    name: 'Ocean Blue',
    colors: { primary: '#0369a1' },
  },
  {
    id: 'forest',
    name: 'Forest Green',
    colors: { primary: '#047857' },
  },
  {
    id: 'sunset',
    name: 'Warm Sunset',
    colors: { primary: '#d97706' },
  },
  {
    id: 'purple',
    name: 'Professional Purple',
    colors: { primary: '#7c3aed' },
  },
]

export const DEFAULT_THEME: ThemeName = 'teal'
const THEME_STORAGE_KEY = 'obsapp-theme'

interface ColorThemeContextType {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
  getCurrentTheme: () => Theme
  availableThemes: Theme[]
}

const ColorThemeContext = createContext<ColorThemeContextType | undefined>(undefined)

export const ColorThemeProvider = ({
  children,
  initialTheme,
}: {
  children: ReactNode
  initialTheme?: string
}) => {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (
      initialTheme &&
      AVAILABLE_THEMES.find((t) => t.id === initialTheme)
    ) {
      return initialTheme as ThemeName
    }
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(THEME_STORAGE_KEY)
      if (stored && AVAILABLE_THEMES.find((t) => t.id === stored)) {
        return stored as ThemeName
      }
    }
    return DEFAULT_THEME
  })

  const syncedInitialTheme = useRef(false)
  useEffect(() => {
    if (!syncedInitialTheme.current && initialTheme) {
      if (AVAILABLE_THEMES.find((t) => t.id === initialTheme)) {
        setThemeState(initialTheme as ThemeName)
        syncedInitialTheme.current = true
      }
    }
  }, [initialTheme])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const root = document.documentElement
      root.removeAttribute('data-theme')
      if (theme !== DEFAULT_THEME) {
        root.setAttribute('data-theme', theme)
      }
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    }
  }, [theme])

  const setTheme = useCallback((newTheme: ThemeName) => {
    setThemeState(newTheme)
    updateUserSettings({ color_theme: newTheme }).catch(() => {
    })
  }, [])

  const getCurrentTheme = useCallback(() => {
    return AVAILABLE_THEMES.find((t) => t.id === theme) || AVAILABLE_THEMES[0]
  }, [theme])

  return (
    <ColorThemeContext.Provider value={{ theme, setTheme, getCurrentTheme, availableThemes: AVAILABLE_THEMES }}>
      {children}
    </ColorThemeContext.Provider>
  )
}

export const useColorTheme = (): ColorThemeContextType => {
  const context = useContext(ColorThemeContext)
  if (!context) {
    throw new Error('useColorTheme must be used within a ColorThemeProvider')
  }
  return context
}
