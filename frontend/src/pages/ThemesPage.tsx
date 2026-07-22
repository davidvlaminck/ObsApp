import { AxiosError } from 'axios'
import { FormEvent, useEffect, useState } from 'react'
import {
  createTheme,
  deleteTheme,
  getThemes,
  ThemeResponse,
  updateTheme,
} from '../services/auth'

const getErrorMessage = (error: unknown, fallback: string) => {
  const axiosError = error as AxiosError<{ detail?: string }>
  const status = axiosError.response?.status
  const detail = axiosError.response?.data?.detail

  if (status === 307) {
    return 'De backend stuurt een redirect terug. Start de backend opnieuw op zodat de nieuwe routes actief zijn.'
  }

  if (status === 401) {
    return 'Sessie verlopen. Log opnieuw in.'
  }

  if (status === 403) {
    return 'Geen toegang.'
  }

  return detail ?? fallback
}

type ThemeForm = {
  name: string
  description: string
}

export default function ThemesPage() {
  const [themes, setThemes] = useState<ThemeResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState<ThemeForm>({ name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const data = await getThemes()
        setThemes(data)
        setError('')
      } catch (err) {
        setError(getErrorMessage(err, 'Kan thema\'s niet laden.'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const resetForm = () => {
    setForm({ name: '', description: '' })
    setEditingId(null)
    setFormOpen(false)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      if (editingId) {
        const updated = await updateTheme(editingId, {
          name: form.name,
          description: form.description || null,
        })
        setSuccess(`Thema ${updated.name} is bijgewerkt.`)
        setThemes((current) => current.map((t) => (t.id === updated.id ? updated : t)))
        resetForm()
      } else {
        const created = await createTheme({
          name: form.name,
          description: form.description || null,
        })
        setSuccess(`Thema ${created.name} is aangemaakt.`)
        setThemes((current) => [...current, created])
        resetForm()
      }
    } catch (err) {
      setError(getErrorMessage(err, editingId ? 'Kan thema niet bijwerken.' : 'Kan thema niet aanmaken.'))
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (theme: ThemeResponse) => {
    setForm({ name: theme.name, description: theme.description || '' })
    setEditingId(theme.id)
    setFormOpen(true)
  }

  const handleDelete = async (themeId: number, themeName: string) => {
    if (!window.confirm(`Thema "${themeName}" verwijderen?`)) return
    setError('')
    setSuccess('')
    try {
      await deleteTheme(themeId)
      setSuccess(`Thema ${themeName} is verwijderd.`)
      setThemes((current) => current.filter((t) => t.id !== themeId))
      if (editingId === themeId) {
        resetForm()
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Kan thema niet verwijderen.'))
    }
  }

  if (loading) {
    return (
      <div className="center-container">
        <div className="card">
          <p>Laden...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <section className="page-header">
        <div>
          <h1>Thema's</h1>
          <p className="text-muted">Beheer thema's voor observaties en activiteiten.</p>
        </div>
      </section>

      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      <div className="management-grid">
        <div className="table-card">
          <div className="table-header">
            <div>
              <h2>Thema lijst</h2>
              <p className="text-muted">{themes.length === 0 ? 'Nog geen thema\'s.' : ''}</p>
            </div>
            <div className="table-actions">
              <button className="btn btn-primary" type="button" onClick={() => { resetForm(); setFormOpen((open) => !open) }}>
                {formOpen && !editingId ? 'Formulier sluiten' : 'Thema aanmaken'}
              </button>
            </div>
          </div>

          {formOpen && (
            <div className="card form-card">
              <h2>{editingId ? 'Thema bijwerken' : 'Nieuw thema'}</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="theme-name">Naam</label>
                  <input
                    id="theme-name"
                    type="text"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    required
                    disabled={saving}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="theme-description">Omschrijving</label>
                  <textarea
                    id="theme-description"
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    rows={3}
                    disabled={saving}
                  />
                </div>
                <button
                  className={`btn btn-primary ${editingId ? 'btn-sm' : ''}`}
                  type="submit"
                  disabled={saving}
                  style={editingId ? { width: 'auto' } : undefined}
                >
                  {saving ? 'Opslaan...' : editingId ? 'Bijwerken' : 'Aanmaken'}
                </button>
                {editingId && (
                  <button className="btn btn-outline" type="button" onClick={resetForm} style={{ marginLeft: 8 }}>
                    Annuleren
                  </button>
                )}
              </form>
            </div>
          )}

          {themes.length === 0 ? (
            <div className="empty-state">
              <h2>Geen thema's gevonden</h2>
              <p className="text-muted">Maak hierboven een nieuw thema aan.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Naam</th>
                    <th>Omschrijving</th>
                    <th>Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {themes.map((theme) => (
                    <tr key={theme.id}>
                      <td>
                        <strong>{theme.name}</strong>
                      </td>
                      <td>{theme.description || '-'}</td>
                      <td>
                        <button className="table-action" type="button" onClick={() => startEdit(theme)}>
                          Bewerken
                        </button>
                        <button className="table-action table-action-danger" type="button" onClick={() => handleDelete(theme.id, theme.name)}>
                          Verwijderen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
