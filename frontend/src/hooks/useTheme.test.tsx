/// <reference types="vitest/globals" />
import { render, screen, fireEvent, act } from '@testing-library/react'

import { ColorThemeProvider, useColorTheme } from '../hooks/useTheme'

const mockUpdateUserSettings = vi.fn()
vi.mock('../services/auth', () => ({
  updateUserSettings: (data: unknown) => mockUpdateUserSettings(data),
}))

const TestConsumer = () => {
  const { theme, setTheme, getCurrentTheme, availableThemes } = useColorTheme()
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <span data-testid="theme-name">{getCurrentTheme().name}</span>
      <button data-testid="theme-count">{availableThemes.length}</button>
      <button onClick={() => setTheme('ocean')}>Switch to Ocean</button>
      <button onClick={() => setTheme('teal')}>Switch to Teal</button>
    </div>
  )
}

beforeEach(() => {
  localStorage.clear()
  mockUpdateUserSettings.mockClear()
  mockUpdateUserSettings.mockResolvedValue({ color_theme: 'teal' })
})

describe('useColorTheme', () => {
  it('initializes with default theme when no initialTheme is provided', () => {
    render(
      <ColorThemeProvider>
        <TestConsumer />
      </ColorThemeProvider>,
    )

    expect(screen.getByTestId('current-theme').textContent).toBe('teal')
    expect(screen.getByTestId('theme-name').textContent).toBe('Modern Teal')
  })

  it('initializes with the provided initialTheme', () => {
    render(
      <ColorThemeProvider initialTheme="purple">
        <TestConsumer />
      </ColorThemeProvider>,
    )

    expect(screen.getByTestId('current-theme').textContent).toBe('purple')
    expect(screen.getByTestId('theme-name').textContent).toBe('Professional Purple')
  })

  it('falls back to default for invalid initialTheme', () => {
    render(
      <ColorThemeProvider initialTheme="invalid-theme">
        <TestConsumer />
      </ColorThemeProvider>,
    )

    expect(screen.getByTestId('current-theme').textContent).toBe('teal')
  })

  it('provides all available themes', () => {
    render(
      <ColorThemeProvider>
        <TestConsumer />
      </ColorThemeProvider>,
    )

    expect(screen.getByTestId('theme-count').textContent).toBe('5')
  })

  it('applies data-theme attribute to document when theme changes', () => {
    render(
      <ColorThemeProvider>
        <TestConsumer />
      </ColorThemeProvider>,
    )

    act(() => {
      fireEvent.click(screen.getByText('Switch to Ocean'))
    })

    expect(screen.getByTestId('current-theme').textContent).toBe('ocean')
    expect(document.documentElement.getAttribute('data-theme')).toBe('ocean')
  })

  it('removes data-theme attribute when switching back to default', () => {
    render(
      <ColorThemeProvider initialTheme="forest">
        <TestConsumer />
      </ColorThemeProvider>,
    )

    expect(document.documentElement.getAttribute('data-theme')).toBe('forest')

    act(() => {
      fireEvent.click(screen.getByText('Switch to Teal'))
    })

    expect(screen.getByTestId('current-theme').textContent).toBe('teal')
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  })

  it('calls updateUserSettings when theme changes', () => {
    render(
      <ColorThemeProvider>
        <TestConsumer />
      </ColorThemeProvider>,
    )

    act(() => {
      fireEvent.click(screen.getByText('Switch to Ocean'))
    })

    expect(mockUpdateUserSettings).toHaveBeenCalledWith({ color_theme: 'ocean' })
  })

  it('throws when useColorTheme is used outside ColorThemeProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<TestConsumer />)).toThrow(
      'useColorTheme must be used within a ColorThemeProvider',
    )

    spy.mockRestore()
  })
})
