import { AxiosError } from 'axios'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { FormEvent, useEffect, useState } from 'react'
import { sortSubjects } from '../lib/subjectSort'
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
  updateActivity,
} from '../services/auth'
import {
  getObservationGoalDomains,
  getObservationGoalSubdomains,
  getObservationGoalSubjects,
  getObservationGoals,
  getUserClasses,
  ObservationGoalResponse,
  ClassOption,
} from '../services/observations'

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
  const [userClasses, setUserClasses] = useState<ClassOption[]>([])

  const [goalModal, setGoalModal] = useState<{
    open: boolean
    activityId: number | null
    subject: string
    domain: string
    subdomain: string
    level: string
    q: string
    goals: ObservationGoalResponse[]
    tempSelectedItems: Array<{ goal_id: number; label: string | null; observe: boolean }>
    subjects: string[]
    domains: string[]
    subdomains: string[]
    saving: boolean
    error: string
  }>({
    open: false,
    activityId: null,
    subject: '',
    domain: '',
    subdomain: '',
    level: '',
    q: '',
    goals: [],
    tempSelectedItems: [],
    subjects: [],
    domains: [],
    subdomains: [],
    saving: false,
    error: '',
  })

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
        const userClassesData = await getUserClasses()
        setUserClasses(userClassesData)
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

  const openGoalModal = (activity: ActivityResponse) => {
    const defaultLevel = userClasses.length === 1 ? userClasses[0].class_type : ''
    setGoalModal((current) => ({
      ...current,
      open: true,
      activityId: activity.id,
      tempSelectedItems: activity.goals.map((g) => ({ goal_id: g.goal_id, label: g.label, observe: g.observe })),
      subject: '',
      domain: '',
      subdomain: '',
      level: defaultLevel,
      q: '',
      goals: [],
      domains: [],
      subdomains: [],
      saving: false,
      error: '',
    }))
  }

  const closeGoalModal = () => {
    setGoalModal((current) => ({ ...current, open: false, activityId: null }))
  }

  const confirmGoalSelection = async () => {
    if (!goalModal.activityId) {
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')
      await updateActivity(goalModal.activityId, {
        name: themeActivities.find((a) => a.id === goalModal.activityId)?.name || '',
        description: themeActivities.find((a) => a.id === goalModal.activityId)?.description || '',
        theme_id: editingTheme?.id || 0,
        goal_items: goalModal.tempSelectedItems,
      })
      setSuccess('Doelen bijgewerkt.')
      closeGoalModal()
      if (editingTheme) {
        await loadActivitiesForTheme(editingTheme.id)
      }
    } catch (err: any) {
      setError(getErrorMessage(err, 'Kan doelen niet bijwerken.'))
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const loadSubjects = async () => {
      if (!goalModal.open) {
        return
      }
      try {
        const subjects = await getObservationGoalSubjects()
        setGoalModal((current) => ({ ...current, subjects, subject: '' }))
      } catch {
        // non-blocking
      }
    }
    loadSubjects()
  }, [goalModal.open])

  useEffect(() => {
    const loadDomains = async () => {
      if (!goalModal.open || !goalModal.subject) {
        setGoalModal((current) => ({ ...current, domains: [], domain: '', subdomains: [], subdomain: '' }))
        return
      }
      try {
        const domains = await getObservationGoalDomains(goalModal.subject)
        setGoalModal((current) => ({ ...current, domains, domain: '', subdomains: [], subdomain: '' }))
      } catch {
        // non-blocking
      }
    }
    loadDomains()
  }, [goalModal.open, goalModal.subject])

  useEffect(() => {
    const loadSubdomains = async () => {
      if (!goalModal.open || !goalModal.subject) {
        setGoalModal((current) => ({ ...current, subdomains: [], subdomain: '' }))
        return
      }
      try {
        const subdomains = await getObservationGoalSubdomains(goalModal.subject, goalModal.domain || undefined)
        setGoalModal((current) => ({ ...current, subdomains, subdomain: '' }))
      } catch {
        // non-blocking
      }
    }
    loadSubdomains()
  }, [goalModal.open, goalModal.subject, goalModal.domain])

  useEffect(() => {
    const loadGoals = async () => {
      if (!goalModal.open) {
        return
      }
      setGoalModal((current) => ({ ...current, saving: true, error: '' }))
      try {
        const data = await getObservationGoals({
          subject: goalModal.subject || undefined,
          domain: goalModal.domain || undefined,
          subdomain: goalModal.subdomain || undefined,
          q: goalModal.q || undefined,
        })
        setGoalModal((current) => ({ ...current, goals: data, saving: false }))
      } catch (err) {
        setGoalModal((current) => ({ ...current, error: getErrorMessage(err, 'Kan doelen niet laden.'), saving: false }))
      }
    }
    loadGoals()
  }, [goalModal.open, goalModal.subject, goalModal.domain, goalModal.subdomain, goalModal.q])

  const filteredGoals = goalModal.goals.filter((goal) => {
    if (goalModal.level && goal.goal?.level !== goalModal.level) {
      return false
    }
    return true
  })

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
                                className="btn btn-outline btn-sm"
                                type="button"
                                onClick={() => openGoalModal(activity)}
                                disabled={saving}
                                style={{ marginRight: 8 }}
                              >
                                Doelen koppelen
                              </button>
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

      {goalModal.open && goalModal.activityId && (
        <div className="modal-backdrop">
          <section className="modal-card goal-select-modal" role="dialog" aria-modal="true" aria-labelledby="goal-select-title">
            <div className="modal-header">
              <div>
                <h2 id="goal-select-title">Koppel doelen</h2>
                <p className="text-muted">Filter op vak, domein en subdomein. Selecteer een of meer doelen.</p>
              </div>
              <button className="icon-button" type="button" onClick={closeGoalModal} aria-label="Sluiten">
                ✕
              </button>
            </div>

            <div className="goal-modal-filters">
              <div className="form-group">
                <label htmlFor="goal-select-subject">Vak</label>
                <select
                  id="goal-select-subject"
                  value={goalModal.subject}
                  onChange={(event) =>
                    setGoalModal((current) => ({
                      ...current,
                      subject: event.target.value,
                      domain: '',
                      subdomain: '',
                    }))
                  }
                >
                  <option value="">Alle vakken</option>
                  {sortSubjects(goalModal.subjects).map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="goal-select-domain">Domein</label>
                <select
                  id="goal-select-domain"
                  value={goalModal.domain}
                  disabled={!goalModal.subject}
                  onChange={(event) =>
                    setGoalModal((current) => ({
                      ...current,
                      domain: event.target.value,
                      subdomain: '',
                    }))
                  }
                >
                  <option value="">Alle domeinen</option>
                  {goalModal.domains.map((domain) => (
                    <option key={domain} value={domain}>
                      {domain}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="goal-select-subdomain">Subdomein</label>
                <select
                  id="goal-select-subdomain"
                  value={goalModal.subdomain}
                  disabled={!goalModal.subject}
                  onChange={(event) =>
                    setGoalModal((current) => ({
                      ...current,
                      subdomain: event.target.value,
                    }))
                  }
                >
                  <option value="">Alle subdomeinen</option>
                  {goalModal.subdomains.map((subdomain) => (
                    <option key={subdomain} value={subdomain}>
                      {subdomain}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="goal-select-level">Klasgroep</label>
                <select
                  id="goal-select-level"
                  value={goalModal.level}
                  onChange={(event) =>
                    setGoalModal((current) => ({
                      ...current,
                      level: event.target.value,
                    }))
                  }
                >
                  <option value="">Alle klasgroepen</option>
                  <option value="JK">JK</option>
                  <option value="K2">2K</option>
                  <option value="K3">3K</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="goal-select-q">Zoek in omschrijving</label>
                <input
                  id="goal-select-q"
                  value={goalModal.q}
                  onChange={(event) =>
                    setGoalModal((current) => ({
                      ...current,
                      q: event.target.value,
                    }))
                  }
                  placeholder="Typ minstens 2 tekens"
                />
              </div>
            </div>

            <div className="goal-select-list">
              {goalModal.saving ? (
                <div className="empty-state compact">
                  <p className="text-muted">Laden...</p>
                </div>
              ) : filteredGoals.length === 0 ? (
                <div className="empty-state compact">
                  <h3>Geen doelen gevonden</h3>
                  <p className="text-muted">Pas de filters aan.</p>
                </div>
              ) : (
                filteredGoals.map((goal) => {
                  const selectedItem = goalModal.tempSelectedItems.find((item) => item.goal_id === goal.id)
                  const isSelected = !!selectedItem
                  return (
                    <label
                      key={goal.id}
                      className={`goal-select-item ${isSelected ? 'selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setGoalModal((current) => ({
                            ...current,
                            tempSelectedItems: isSelected
                              ? current.tempSelectedItems.filter((item) => item.goal_id !== goal.id)
                              : [...current.tempSelectedItems, { goal_id: goal.id, label: null, observe: true }],
                          }))
                        }}
                      />
                      <span>
                        <strong>
                          {goal.goal ? `${goal.goal.code} - ${goal.goal.title}` : goal.name}
                        </strong>
                        <span className="goal-metadata">
                          {' '}
                          {[goal.subject, goal.domain, goal.subdomain].filter(Boolean).join(' · ')}
                        </span>
                        {goal.goal?.goal_type === 'OP_STAP' && goal.goal?.voorbeelden && (
                          <span className="goal-metadata">Voorbeelden: {goal.goal.voorbeelden}</span>
                        )}
                        {goal.goal && goal.goal.goal_type !== 'OP_STAP' && goal.goal?.description && (
                          <span className="goal-metadata">{goal.goal.description}</span>
                        )}
                      </span>
                    </label>
                  )
                })
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" type="button" onClick={closeGoalModal}>
                Annuleren
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={confirmGoalSelection}
                disabled={goalModal.tempSelectedItems.length === 0}
              >
                Toevoegen ({goalModal.tempSelectedItems.length})
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
