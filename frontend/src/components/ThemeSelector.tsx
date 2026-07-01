import { useTheme } from '../hooks/useTheme'

export function ThemeSelector() {
  const { theme, setTheme, availableThemes } = useTheme()

  return (
    <div className="theme-selector">
      <span className="theme-selector-title">Theme</span>
      <div className="theme-options">
        {availableThemes.map((t) => (
          <button
            key={t.id}
            className={`theme-option-btn ${theme === t.id ? 'active' : ''}`}
            onClick={() => setTheme(t.id)}
            title={`Switch to ${t.name} theme`}
          >
            {t.name}
          </button>
        ))}
      </div>
    </div>
  )
}
