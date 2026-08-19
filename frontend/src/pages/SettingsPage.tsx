import { useCallback, useState } from 'react'

import { useColorTheme, isValidHexColor, DEFAULT_STATUS_COLORS } from '../hooks/useTheme'
import StatusColorInput from '../components/StatusColorInput'

const STATUS_COLOR_OPTIONS = [
  {
    key: 'onvoldoende',
    label: 'Onvoldoende',
    description: 'Rood',
  },
  {
    key: 'in_ontwikkeling',
    label: 'In ontwikkeling',
    description: 'Oranje',
  },
  {
    key: 'voldoende',
    label: 'Voldoende',
    description: 'Groen',
  },
  {
    key: 'voorsprong',
    label: 'Voorsprong',
    description: 'Blauw',
  },
]

export default function SettingsPage() {
  const { theme, setTheme, availableThemes, statusColors, updateStatusColors } = useColorTheme()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [draftColors, setDraftColors] = useState<Record<string, string>>(statusColors)

  const handleColorChange = useCallback((key: string, value: string) => {
    setDraftColors((current) => ({ ...current, [key]: value }))
  }, [])

  const handleSaveColors = useCallback(async () => {
    const invalid = Object.entries(draftColors).filter(([, value]) => !isValidHexColor(value))
    if (invalid.length > 0) {
      setError(`Ongeldige kleurcode${invalid.length > 1 ? 'n' : ''}: ${invalid.map(([k]) => k).join(', ')}. Gebruik #RRGGBB formaat.`)
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await updateStatusColors(draftColors)
      setSuccess('Statuskleuren opgeslagen.')
    } catch {
      setError('Kan statuskleuren niet opslaan.')
    } finally {
      setSaving(false)
    }
  }, [draftColors, updateStatusColors])

  const handleResetColors = useCallback(() => {
    setDraftColors({ ...statusColors })
    setError('')
    setSuccess('')
  }, [statusColors])

  const handleResetToDefaults = useCallback(() => {
    setDraftColors({ ...DEFAULT_STATUS_COLORS })
    setError('')
    setSuccess('')
  }, [])

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

      <section className="form-card card">
        <h2>Statuskleuren</h2>
        <p className="text-muted">
          Kies zelf de kleuren voor de observatiestatussen. Klik op de gekleurde knop om de kleurkiezer te openen.
          Pas de hex waarde direct aan. Deze kleuren worden overal in de app gebruikt.
        </p>

        {error && <div className="inline-message inline-message-error">{error}</div>}
        {success && <div className="inline-message inline-message-success">{success}</div>}

        <div className="status-color-editor">
          {STATUS_COLOR_OPTIONS.map((option) => (
            <div key={option.key} className="status-color-row">
              <div className="status-color-info">
                <span className="status-color-label">{option.label}</span>
                <span className="status-color-description">{option.description}</span>
              </div>
              <StatusColorInput
                value={draftColors[option.key] ?? statusColors[option.key] ?? '#888888'}
                onChange={(value) => handleColorChange(option.key, value)}
                label={option.label}
              />
            </div>
          ))}
        </div>

        <div className="status-color-actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={handleSaveColors}
            disabled={saving}
          >
            {saving ? 'Opslaan...' : 'Kleuren opslaan'}
          </button>
          <button
            className="btn btn-outline"
            type="button"
            onClick={handleResetColors}
            disabled={saving}
          >
            Herstellen naar opgeslagen
          </button>
        </div>
      </section>
    </div>
  )
}
