import { useColorTheme } from '../hooks/useTheme'

export default function SettingsPage() {
  const { theme, setTheme, availableThemes } = useColorTheme()

  return (
    <div>
      <section className="page-header">
        <div>
          <h1>Instellingen</h1>
          <p className="text-muted">Pas je instellingen aan voor een optimale werkervaring.</p>
        </div>
      </section>

      <section className="form-card card">
        <h2>Kleurthema</h2>
        <p className="text-muted">
          Kies een thema dat passend is bij jouw voorkeur. Het thema wordt per gebruiker opgeslagen en blijft
          bewaard voor volgende sessies.
        </p>

        <div className="color-theme-grid">
          {availableThemes.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`color-theme-option ${theme === t.id ? 'active' : ''}`}
              onClick={() => setTheme(t.id)}
              aria-label={`Kies thema ${t.name}`}
              title={t.name}
            >
              <span
                className="color-theme-swatch"
                style={{ backgroundColor: t.colors.primary }}
                aria-hidden="true"
              />
              <span className="color-theme-label">{t.name}</span>
              {theme === t.id && (
                <span className="color-theme-check" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
