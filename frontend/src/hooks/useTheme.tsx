import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

import { getUserSettings, updateUserSettings, type UserSettingsResponse } from '../services/auth'

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

export const DEFAULT_STATUS_COLORS: Record<string, string> = {
  onvoldoende: '#ef5350',
  in_ontwikkeling: '#ff9800',
  voldoende: '#66bb6a',
  voorsprong: '#42a5f5',
}

export function getEffectiveStatusColors(settings: UserSettingsResponse | null | undefined): Record<string, string> {
  return { ...DEFAULT_STATUS_COLORS, ...(settings?.status_colors ?? {}) }
}

export function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#([0-9a-fA-F]{6})$/)
  if (!match) return null
  const num = parseInt(match[1], 16)
  return { r: (num >> 16) & 0xff, g: (num >> 8) & 0xff, b: num & 0xff }
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')
}

export function lightenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  return rgbToHex(
    rgb.r + (255 - rgb.r) * amount,
    rgb.g + (255 - rgb.g) * amount,
    rgb.b + (255 - rgb.b) * amount
  )
}

export function darkenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  return rgbToHex(
    rgb.r * (1 - amount),
    rgb.g * (1 - amount),
    rgb.b * (1 - amount)
  )
}

export function getContrastColor(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#000000'
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.6 ? '#1f2937' : '#ffffff'
}

interface ColorThemeContextType {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
  getCurrentTheme: () => Theme
  availableThemes: Theme[]
  statusColors: Record<string, string>
  updateStatusColors: (colors: Record<string, string>) => Promise<void>
  userSettings: UserSettingsResponse | null
}

const ColorThemeContext = createContext<ColorThemeContextType | undefined>(undefined)

export const ColorThemeProvider = ({
  children,
  initialTheme,
  initialStatusColors,
}: {
  children: ReactNode
  initialTheme?: string
  initialStatusColors?: Record<string, string>
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

  const [statusColors, setStatusColors] = useState<Record<string, string>>(() => {
    if (initialStatusColors) {
      return { ...DEFAULT_STATUS_COLORS, ...initialStatusColors }
    }
    return { ...DEFAULT_STATUS_COLORS }
  })

  const [userSettings, setUserSettings] = useState<UserSettingsResponse | null>(null)

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
    updateUserSettings({ color_theme: newTheme }).catch(() => {})
  }, [])

  const getCurrentTheme = useCallback(() => {
    return AVAILABLE_THEMES.find((t) => t.id === theme) || AVAILABLE_THEMES[0]
  }, [theme])

  const updateStatusColors = useCallback(async (colors: Record<string, string>) => {
    setStatusColors({ ...DEFAULT_STATUS_COLORS, ...colors })
    try {
      const response = await updateUserSettings({ status_colors: colors })
      setUserSettings(response)
    } catch {
      setStatusColors(getEffectiveStatusColors(userSettings))
    }
  }, [userSettings])

  useEffect(() => {
    let cancelled = false
    getUserSettings().then((settings) => {
      if (!cancelled) {
        setUserSettings(settings)
        setStatusColors(getEffectiveStatusColors(settings))
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <ColorThemeContext.Provider
      value={{
        theme,
        setTheme,
        getCurrentTheme,
        availableThemes: AVAILABLE_THEMES,
        statusColors,
        updateStatusColors,
        userSettings,
      }}
    >
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
