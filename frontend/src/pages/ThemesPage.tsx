import { AxiosError } from 'axios'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { FormEvent, useEffect, useState } from 'react'
import {
  createActivity,
  createTheme,
  deleteActivity,
  deleteTheme,
  getActivities,
  getThemes,
  ActivityResponse,
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

export default function ThemesPage() {
  const [themes, setThemes] = useState<ThemeResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [newThemeName, setNewThemeName] = useState('')
  const [newThemeDescription, setNewThemeDescription] = useState('')
  const [showNewThemeForm, setShowNewThemeForm] = useState(false)

  const [editingTheme, setEditingTheme] = useState<ThemeResponse | null>(null)
  const [editingThemeName, setEditingThemeName] = useState('')
  const [editingThemeDescription, setEditingThemeDescription] = useState('')
  const [editingThemeNameVisible, setEditingThemeNameVisible] = useState(false)

  const [themeActivities, setThemeActivities] = useState<ActivityResponse[]>([])
  const [loadingActivities, setLoadingActivities] = useState(false)
  const [newActivityName, setNewActivityName] = useState('')
  const [newActivityDescription, setNewActivityDescription] = useState('')
  const [showNewActivityForm, setShowNewActivityForm] = useState(false)

  const loadThemes = async () => {
    try {
      const data = await getThemes()
      setThemes(data)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err, 'Kan thema\'s niet laden.'))
    }
  }

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        await loadThemes()
      } catch (err) {
        setError(getErrorMessage(err, 'Kan gegevens niet laden.'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleCreateTheme = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = newThemeName.trim()
    if (!trimmedName) {
      setError('Geen themanaam ingevuld.')
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')
      const created = await createTheme({
        name: trimmedName,
        description: newThemeDescription.trim() || null,
      })
      setThemes((current) => [...current, created])
      setNewThemeName('')
      setNewThemeDescription('')
      setShowNewThemeForm(false)
      setSuccess(`Thema "${trimmedName}" is toegevoegd.`)
    } catch (err: any) {
      setError(getErrorMessage(err, 'Kan thema niet toevoegen.'))
    } finally {
      setSaving(false)
    }
  }

  const handleCancelNewTheme = () => {
    setShowNewThemeForm(false)
    setNewThemeName('')
    setNewThemeDescription('')
    setError('')
  }

  const startEditTheme = (theme: ThemeResponse) => {
    setEditingTheme(theme)
    setEditingThemeName(theme.name)
    setEditingThemeDescription(theme.description || '')
    setEditingThemeNameVisible(false)
    setShowNewActivityForm(false)
    setNewActivityName('')
    setNewActivityDescription('')
  }

  useEffect(() => {
    if (editingTheme) {
      loadActivitiesForTheme(editingTheme.id)
    }
  }, [editingTheme])

  const cancelEditTheme = () => {
    setEditingTheme(null)
    setEditingThemeName('')
    setEditingThemeDescription('')
    setEditingThemeNameVisible(false)
    setShowNewActivityForm(false)
    setNewActivityName('')
    setNewActivityDescription('')
    setThemeActivities([])
  }

  const saveEditTheme = async () => {
    const trimmedName = editingThemeName.trim()
    if (!trimmedName) {
      setError('Geen themanaam ingevuld.')
      return
    }

    if (!editingTheme) {
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')
      const updated = await updateTheme(editingTheme.id, {
        name: trimmedName,
        description: editingThemeDescription.trim() || null,
      })
      setThemes((current) => current.map((t) => (t.id === updated.id ? updated : t)))
      setEditingTheme((current) => (current && current.id === updated.id ? updated : current))
      setEditingThemeNameVisible(false)
      setSuccess(`Thema is bijgewerkt.`)
    } catch (err: any) {
      setError(getErrorMessage(err, 'Kan thema niet bijwerken.'))
    } finally {
      setSaving(false)
    }
  }

  const cancelEditThemeName = () => {
    setEditingThemeNameVisible(false)
    setEditingThemeName(editingTheme?.name ?? '')
    setError('')
  }

  const loadActivitiesForTheme = async (themeId: number) => {
    try {
      setLoadingActivities(true)
      const data = await getActivities({ theme_id: themeId })
      setThemeActivities(data)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err, 'Kan activiteiten niet laden.'))
    } finally {
      setLoadingActivities(false)
    }
  }

  const handleCreateActivity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingTheme) {
      return
    }

    const trimmedName = newActivityName.trim()
    if (!trimmedName) {
      setError('Geen activiteitnaam ingevuld.')
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')
      await createActivity({
        name: trimmedName,
        description: newActivityDescription.trim() || null,
        theme_id: editingTheme.id,
        goal_items: [],
      })
      setNewActivityName('')
      setNewActivityDescription('')
      setShowNewActivityForm(false)
      setSuccess(`Activiteit "${trimmedName}" is aangemaakt.`)
      await loadActivitiesForTheme(editingTheme.id)
      await loadThemes()
    } catch (err: any) {
      setError(getErrorMessage(err, 'Kan activiteit niet aanmaken.'))
    } finally {
      setSaving(false)
    }
  }

  const cancelNewActivity = () => {
    setShowNewActivityForm(false)
    setNewActivityName('')
    setNewActivityDescription('')
    setError('')
  }

  const handleDeleteActivity = async (activityId: number, activityName: string) => {
    if (!window.confirm(`Activiteit "${activityName}" verwijderen?`)) {
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')
      await deleteActivity(activityId)
      setSuccess(`Activiteit "${activityName}" is verwijderd.`)
      setThemeActivities((current) => current.filter((a) => a.id !== activityId))
      await loadThemes()
    } catch (err) {
      setError(getErrorMessage(err, 'Kan activiteit niet verwijderen.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTheme = async (themeId: number, themeName: string) => {
    if (!window.confirm(`Thema "${themeName}" verwijderen?`)) {
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')
      await deleteTheme(themeId)
      setThemes((current) => current.filter((t) => t.id !== themeId))
      setSuccess(`Thema "${themeName}" is verwijderd.`)
    } catch (err) {
      setError(getErrorMessage(err, 'Kan thema niet verwijderen.'))
    } finally {
      setSaving(false)
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

      {error && <div className="inline-message inline-message-error">{error}</div>}
      {success && <div className="inline-message inline-message-success">{success}</div>}

      <div className="management-grid">
        <section className="form-card card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <h2>Thema's beheren</h2>
              <p className="text-muted">Beheer de thema's die je bij activiteiten kunt gebruiken.</p>
            </div>
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => setShowNewThemeForm(true)}
              disabled={saving}
            >
              <AddIcon fontSize="small" aria-hidden="true" style={{ marginRight: 8 }} />
              Nieuw thema
            </button>
          </div>

          <div style={{ marginBottom: 16 }}>
            {themes.length === 0 ? (
              <div className="empty-state compact">
                <h3>Geen thema's</h3>
                <p className="text-muted">Klik op de knop hieronder om je eerste thema toe te voegen.</p>
              </div>
            ) : (
              <div className="user-list">
                {themes.map((theme) => (
                  <div key={theme.id} className="user-item">
                    <div>
                      <strong>{theme.name}</strong>
                      {theme.description && (
                        <p className="text-muted" style={{ margin: 0 }}>{theme.description}</p>
                      )}
                    </div>
                    <div className="domain-actions">
                      <button
                        className="table-action edit-icon-button"
                        type="button"
                        onClick={() => startEditTheme(theme)}
                        aria-label={`Bewerk ${theme.name}`}
                        title="Bewerken"
                        disabled={saving}
                      >
                        <EditIcon fontSize="small" aria-hidden="true" />
                      </button>
                      <button
                        className="table-action danger-link delete-icon-button"
                        type="button"
                        onClick={() => handleDeleteTheme(theme.id, theme.name)}
                        aria-label={`Verwijder ${theme.name}`}
                        title="Verwijderen"
                        disabled={saving}
                      >
                        <DeleteIcon fontSize="small" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {showNewThemeForm && (
        <div className="modal-backdrop" onClick={() => handleCancelNewTheme()}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Nieuw thema</h2>
                <p>Voer de naam en beschrijving van het nieuwe thema in.</p>
              </div>
            </div>

            <section className="form-card card" style={{ marginBottom: 24 }}>
              <form onSubmit={handleCreateTheme}>
                <div className="form-group">
                  <label htmlFor="new-theme-name">Naam</label>
                  <input
                    id="new-theme-name"
                    value={newThemeName}
                    onChange={(event) => setNewThemeName(event.target.value)}
                    placeholder="Bijv. Bos en natuur"
                    autoFocus
                    disabled={saving}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="new-theme-description">Beschrijving</label>
                  <textarea
                    id="new-theme-description"
                    value={newThemeDescription}
                    onChange={(event) => setNewThemeDescription(event.target.value)}
                    placeholder="Korte beschrijving van het thema (optioneel)"
                    rows={3}
                    disabled={saving}
                  />
                </div>
                <div className="modal-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    type="submit"
                    disabled={saving}
                  >
                    {saving ? 'Opslaan...' : 'Opslaan'}
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    type="button"
                    onClick={handleCancelNewTheme}
                    disabled={saving}
                  >
                    Annuleren
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      )}

      {editingTheme && (
        <div className="modal-backdrop" onClick={() => cancelEditTheme()}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Thema {editingTheme.name}</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-outline btn-sm"
                  type="button"
                  onClick={() => setEditingThemeNameVisible(true)}
                  disabled={saving}
                  aria-label="Bewerk themanaam"
                  title="Naam bewerken"
                >
                  <EditIcon fontSize="small" aria-hidden="true" />
                </button>
                <button className="btn btn-sm btn-secondary" type="button" onClick={cancelEditTheme}>
                  Sluiten
                </button>
              </div>
            </div>

            {editingThemeNameVisible && (
              <section className="form-card card" style={{ marginBottom: 24 }}>
                <h3>Themanaam en beschrijving aanpassen</h3>
                <div className="form-group">
                  <label htmlFor="edit-theme-name">Naam</label>
                  <input
                    id="edit-theme-name"
                    type="text"
                    value={editingThemeName}
                    onChange={(e) => setEditingThemeName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        saveEditTheme()
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        cancelEditThemeName()
                      }
                    }}
                    autoFocus
                    disabled={saving}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-theme-description">Beschrijving</label>
                  <textarea
                    id="edit-theme-description"
                    value={editingThemeDescription}
                    onChange={(e) => setEditingThemeDescription(e.target.value)}
                    rows={3}
                    disabled={saving}
                  />
                </div>
                <div className="modal-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    type="button"
                    onClick={saveEditTheme}
                    disabled={saving}
                  >
                    {saving ? 'Opslaan...' : 'Opslaan'}
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    type="button"
                    onClick={cancelEditThemeName}
                    disabled={saving}
                  >
                    Annuleren
                  </button>
                </div>
              </section>
            )}

            <section className="form-card card" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <h3>Activiteiten beheren</h3>
                  <p className="text-muted">Beheer de activiteiten voor dit thema.</p>
                </div>
                {!showNewActivityForm && (
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={() => setShowNewActivityForm(true)}
                    disabled={saving}
                  >
                    <AddIcon fontSize="small" aria-hidden="true" style={{ marginRight: 8 }} />
                    Activiteit aanmaken
                  </button>
                )}
              </div>

              {showNewActivityForm && (
                <form onSubmit={handleCreateActivity}>
                  <div className="form-group">
                    <label htmlFor="modal-activity-name">Naam</label>
                    <input
                      id="modal-activity-name"
                      value={newActivityName}
                      onChange={(e) => setNewActivityName(e.target.value)}
                      placeholder="Bijvoorbeeld: Verkenning van het bos"
                      required
                      disabled={saving}
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="modal-activity-description">Beschrijving</label>
                    <textarea
                      id="modal-activity-description"
                      value={newActivityDescription}
                      onChange={(e) => setNewActivityDescription(e.target.value)}
                      placeholder="Korte beschrijving van de activiteit (optioneel)"
                      rows={3}
                      disabled={saving}
                    />
                  </div>
                  <div className="modal-actions">
                    <button
                      className="btn btn-primary btn-sm"
                      type="submit"
                      disabled={saving}
                    >
                      {saving ? 'Opslaan...' : 'Opslaan'}
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      type="button"
                      onClick={cancelNewActivity}
                      disabled={saving}
                    >
                      Annuleren
                    </button>
                  </div>
                </form>
              )}

              <div style={{ marginTop: 24 }}>
                {loadingActivities ? (
                  <p className="text-muted">Laden...</p>
                ) : themeActivities.length === 0 ? (
                  <div className="empty-state compact">
                    <p className="text-muted">Nog geen activiteiten voor dit thema.</p>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Naam</th>
                          <th>Acties</th>
                        </tr>
                      </thead>
                      <tbody>
                        {themeActivities.map((activity) => (
                          <tr key={activity.id}>
                            <td>
                              <strong>{activity.name}</strong>
                            </td>
                            <td>
                              <button
                                className="table-action danger-link delete-icon-button"
                                type="button"
                                onClick={() => handleDeleteActivity(activity.id, activity.name)}
                                aria-label={`Verwijder ${activity.name}`}
                                title="Verwijderen"
                                disabled={saving}
                              >
                                <DeleteIcon fontSize="small" aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
