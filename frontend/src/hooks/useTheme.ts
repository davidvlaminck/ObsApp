import { useEffect, useState, useCallback } from 'react'

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

const THEME_STORAGE_KEY = 'obsapp-theme'
const DEFAULT_THEME: ThemeName = 'teal'

export const useTheme = () => {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    // Load theme from localStorage on initial render
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(THEME_STORAGE_KEY)
      if (stored && AVAILABLE_THEMES.find((t) => t.id === stored)) {
        return stored as ThemeName
      }
    }
    return DEFAULT_THEME
  })

  // Apply theme to document
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const root = document.documentElement
      // Remove all theme attributes
      root.removeAttribute('data-theme')
      // Apply selected theme (only if not default)
      if (theme !== 'teal') {
        root.setAttribute('data-theme', theme)
      }
      // Save to localStorage
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    }
  }, [theme])

  const setTheme = useCallback((newTheme: ThemeName) => {
    setThemeState(newTheme)
  }, [])

  const getCurrentTheme = useCallback(() => {
    return AVAILABLE_THEMES.find((t) => t.id === theme) || AVAILABLE_THEMES[0]
  }, [theme])

  return {
    theme,
    setTheme,
    getCurrentTheme,
    availableThemes: AVAILABLE_THEMES,
  }
}
