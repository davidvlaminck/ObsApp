import { AxiosError } from 'axios'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { FormEvent, useEffect, useState } from 'react'
import {
  createActivity,
  deleteActivity,
  getActivities,
  getActivityDomains,
  getActivitySubdomains,
  getActivitySubjects,
  getAvailableGoals,
  getThemes,
  removeActivityGoal,
  ActivityResponse,
  AvailableGoal,
  ThemeResponse,
  updateActivity,
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

type ActivityForm = {
  name: string
  description: string
  theme_id: number | null
  goal_items: Array<{ goal_id: number; observe: boolean }>
}

type GoalModalState = {
  open: boolean
  subject: string
  domain: string
  subdomain: string
  goals: AvailableGoal[]
  tempSelectedItems: Array<{ goal_id: number; observe: boolean }>
  subjects: string[]
  domains: string[]
  subdomains: string[]
  saving: boolean
  error: string
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivityResponse[]>([])
  const [themes, setThemes] = useState<ThemeResponse[]>([])
  const [availableGoals, setAvailableGoals] = useState<AvailableGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState<ActivityForm>({ name: '', description: '', theme_id: null, goal_items: [] })
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [filterThemeId, setFilterThemeId] = useState<number | null>(null)

  const [goalModal, setGoalModal] = useState<GoalModalState>({
    open: false,
    subject: '',
    domain: '',
    subdomain: '',
    goals: [],
    tempSelectedItems: [],
    subjects: [],
    domains: [],
    subdomains: [],
    saving: false,
    error: '',
  })

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [activitiesData, themesData, goalsData] = await Promise.all([
          getActivities(filterThemeId ? { theme_id: filterThemeId } : undefined),
          getThemes(),
          getAvailableGoals(),
        ])
        setActivities(activitiesData)
        setThemes(themesData)
        setAvailableGoals(goalsData)
        setError('')
      } catch (err) {
        setError(getErrorMessage(err, 'Kan activiteiten niet laden.'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [filterThemeId])

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const subjects = await getActivitySubjects()
        setGoalModal((current) => ({ ...current, subjects, subject: '' }))
      } catch {
        // non-blocking
      }
    }
    loadSubjects()
  }, [])

  useEffect(() => {
    const loadDomains = async () => {
      if (!goalModal.subject) {
        setGoalModal((current) => ({ ...current, domains: [], domain: '', subdomains: [], subdomain: '' }))
        return
      }
      try {
        const domains = await getActivityDomains(goalModal.subject)
        setGoalModal((current) => ({ ...current, domains, domain: '', subdomains: [], subdomain: '' }))
      } catch {
        // non-blocking
      }
    }
    loadDomains()
  }, [goalModal.subject])

  useEffect(() => {
    const loadSubdomains = async () => {
      if (!goalModal.subject) {
        setGoalModal((current) => ({ ...current, subdomains: [], subdomain: '' }))
        return
      }
      try {
        const subdomains = await getActivitySubdomains(goalModal.subject, goalModal.domain || undefined)
        setGoalModal((current) => ({ ...current, subdomains, subdomain: '' }))
      } catch {
        // non-blocking
      }
    }
    loadSubdomains()
  }, [goalModal.subject, goalModal.domain])

  useEffect(() => {
    const loadGoals = async () => {
      if (!goalModal.open) return
      setGoalModal((current) => ({ ...current, saving: true, error: '' }))
      try {
        const data = await getAvailableGoals({
          subject: goalModal.subject || undefined,
          domain: goalModal.domain || undefined,
          subdomain: goalModal.subdomain || undefined,
        })
        setGoalModal((current) => ({ ...current, goals: data, saving: false }))
      } catch (err) {
        setGoalModal((current) => ({ ...current, error: getErrorMessage(err, 'Kan doelen niet laden.'), saving: false }))
      }
    }
    loadGoals()
  }, [goalModal.open, goalModal.subject, goalModal.domain, goalModal.subdomain])

  const resetForm = () => {
    setForm({ name: '', description: '', theme_id: null, goal_items: [] })
    setEditingId(null)
    setFormOpen(false)
  }

  const startEdit = (activity: ActivityResponse) => {
    setForm({
      name: activity.name,
      description: activity.description || '',
      theme_id: activity.theme_id,
      goal_items: activity.goals.map((g) => ({ goal_id: g.goal_id, observe: g.observe })),
    })
    setEditingId(activity.id)
    setFormOpen(true)
  }

  const openGoalModal = () => {
    setGoalModal((current) => ({
      ...current,
      open: true,
      tempSelectedItems: form.goal_items,
    }))
  }

  const closeGoalModal = () => {
    setGoalModal((current) => ({ ...current, open: false }))
  }

  const confirmGoalSelection = () => {
    setForm((current) => ({ ...current, goal_items: goalModal.tempSelectedItems }))
    closeGoalModal()
  }

  const toggleGoal = (goalId: number) => {
    setForm((current) => ({
      ...current,
      goal_items: current.goal_items.filter((item) => item.goal_id !== goalId),
    }))
  }

  const toggleObserve = (goalId: number) => {
    setForm((current) => ({
      ...current,
      goal_items: current.goal_items.map((item) =>
        item.goal_id === goalId ? { ...item, observe: !item.observe } : item
      ),
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        theme_id: form.theme_id ?? undefined,
        goal_items: form.goal_items,
      }
      if (editingId) {
        const updated = await updateActivity(editingId, payload)
        setSuccess(`Activiteit ${updated.name} is bijgewerkt.`)
        setActivities((current) => current.map((a) => (a.id === updated.id ? updated : a)))
        resetForm()
      } else {
        const created = await createActivity(payload)
        setSuccess(`Activiteit ${created.name} is aangemaakt.`)
        setActivities((current) => [created, ...current])
        resetForm()
      }
    } catch (err) {
      setError(getErrorMessage(err, editingId ? 'Kan activiteit niet bijwerken.' : 'Kan activiteit niet aanmaken.'))
    } finally {
      setSaving(false)
    }
  }

  const themeName = (themeId: number | null | undefined) => {
    if (!themeId) return '-'
    return themes.find((t) => t.id === themeId)?.name || '-'
  }

  const handleDelete = async (activityId: number, activityName: string) => {
    if (!window.confirm(`Activiteit "${activityName}" verwijderen?`)) return
    setError('')
    setSuccess('')
    try {
      await deleteActivity(activityId)
      setSuccess(`Activiteit ${activityName} is verwijderd.`)
      setActivities((current) => current.filter((a) => a.id !== activityId))
      if (editingId === activityId) {
        resetForm()
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Kan activiteit niet verwijderen.'))
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
          <h1>Activiteiten</h1>
          <p className="text-muted">Beheer activiteiten, koppel een thema en doelpunten.</p>
        </div>
      </section>

      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      <div className="management-grid">
        <div className="table-card">
          <div className="table-header">
            <div>
              <h2>Activiteiten</h2>
              <p className="text-muted">{activities.length === 0 ? 'Nog geen activiteiten.' : ''}</p>
            </div>
            <div className="table-actions">
              <label className="form-inline" style={{ marginRight: 8 }}>
                <span className="sr-only">Filter op thema</span>
                <select
                  className="table-filter-select"
                  value={filterThemeId ?? ''}
                  onChange={(e) => setFilterThemeId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Alle thema's</option>
                  {themes.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn btn-primary" type="button" onClick={() => { resetForm(); setFormOpen((open) => !open) }}>
                {formOpen && !editingId ? 'Formulier sluiten' : 'Activiteit aanmaken'}
              </button>
            </div>
          </div>

          {formOpen && (
            <div className="card form-card">
              <h2>{editingId ? 'Activiteit bijwerken' : 'Nieuwe activiteit'}</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="activity-name">Naam</label>
                  <input
                    id="activity-name"
                    type="text"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    required
                    disabled={saving}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="activity-description">Omschrijving</label>
                  <textarea
                    id="activity-description"
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    rows={3}
                    disabled={saving}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="activity-theme">Thema</label>
                  <select
                    id="activity-theme"
                    value={form.theme_id ?? ''}
                    onChange={(event) => setForm((current) => ({ ...current, theme_id: event.target.value ? Number(event.target.value) : null }))}
                    disabled={saving}
                  >
                    <option value="">Geen thema</option>
                    {themes.map((theme) => (
                      <option key={theme.id} value={theme.id}>
                        {theme.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Doelen</label>
                  <button className="btn btn-outline" type="button" onClick={openGoalModal} disabled={saving}>
                    Doelen kiezen
                  </button>
                     {form.goal_items.length > 0 && (
                       <div className="goal-select-list" style={{ marginTop: 8 }}>
                         {availableGoals
                           .filter((goal) => form.goal_items.some((item) => item.goal_id === goal.id))
                           .map((goal) => {
                             const item = form.goal_items.find((i) => i.goal_id === goal.id)!
                             return (
                               <div
                                 key={goal.id}
                                 style={{
                                   display: 'flex',
                                   alignItems: 'center',
                                   gap: 8,
                                   padding: '4px 0',
                                 }}
                               >
                                 <span style={{ flex: 1, minWidth: 0 }}>
                                   <strong>{goal.title || goal.code}</strong>
                                   <span style={{ fontSize: 12, color: 'var(--md-text-secondary)' }}>
                                     {' '}
                                     {[goal.subject, goal.domain, goal.subdomain].filter(Boolean).join(' · ')}
                                   </span>
                                 </span>
                                 <label
                                   style={{
                                     display: 'inline-flex',
                                     alignItems: 'center',
                                     gap: 4,
                                     cursor: 'pointer',
                                     userSelect: 'none',
                                     flexShrink: 0,
                                   }}
                                   onClick={(e) => e.stopPropagation()}
                                 >
                                   <input
                                     type="checkbox"
                                     checked={item.observe}
                                     onChange={() => toggleObserve(goal.id)}
                                     disabled={saving}
                                   />
                                   <span style={{ fontSize: 13, whiteSpace: 'nowrap' }}>Observeren</span>
                                 </label>
                                 <button
                                   className="table-action danger-link delete-icon-button"
                                   type="button"
                                   onClick={() => toggleGoal(goal.id)}
                                   disabled={saving}
                                   aria-label="Verwijder doel"
                                   title="Verwijder doel"
                                   style={{ flexShrink: 0 }}
                                 >
                                   <DeleteIcon fontSize="small" aria-hidden="true" />
                                 </button>
                               </div>
                             )
                           })}
                       </div>
                     )}
                </div>
                <button className="btn btn-primary" type="submit" disabled={saving} style={{ width: editingId ? 'auto' : undefined }}>
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

          {activities.length === 0 ? (
            <div className="empty-state">
              <h2>Geen activiteiten gevonden</h2>
              <p className="text-muted">Maak hierboven een nieuwe activiteit aan.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Naam</th>
                    <th>Omschrijving</th>
                    <th>Thema</th>
                    <th>Doelen</th>
                    <th>Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((activity) => (
                    <tr key={activity.id}>
                      <td>
                        <strong>{activity.name}</strong>
                      </td>
                      <td>{activity.description || '-'}</td>
                      <td>{themeName(activity.theme_id)}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {activity.goals.map((goal) => (
                            <span key={goal.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                              <span style={{ fontWeight: 500 }}>{goal.title || goal.code}</span>
                              <span className="goal-metadata">{goal.goal_type}</span>
                              {editingId === activity.id && (
                                <button
                                  className="table-action danger-link delete-icon-button"
                                  type="button"
                                  onClick={async () => {
                                    setError('')
                                    setSuccess('')
                                    try {
                                      await removeActivityGoal(activity.id, goal.id)
                                      setSuccess(`Doel verwijderd uit activiteit.`)
                                      setActivities((current) =>
                                        current.map((a) =>
                                          a.id === activity.id
                                            ? {
                                                ...a,
                                                goals: a.goals.filter((g) => g.id !== goal.id),
                                              }
                                            : a,
                                        ),
                                      )
                                      setForm((current) => ({
                                        ...current,
                                        goal_items: current.goal_items.filter((item) => item.goal_id !== goal.goal_id),
                                      }))
                                    } catch (err) {
                                      setError(getErrorMessage(err, 'Kan doel niet verwijderen.'))
                                    }
                                  }}
                                  aria-label="Verwijder doel"
                                  title="Verwijder doel"
                                >
                                  <DeleteIcon fontSize="small" aria-hidden="true" />
                                </button>
                              )}
                            </span>
                          ))}
                          {activity.goals.length === 0 && <span className="text-muted">Geen doelen</span>}
                        </div>
                      </td>
                      <td>
                        <button
                          className="table-action edit-icon-button"
                          type="button"
                          onClick={() => startEdit(activity)}
                          aria-label="Bewerken"
                          title="Bewerken"
                        >
                          <EditIcon fontSize="small" aria-hidden="true" />
                        </button>
                        <button
                          className="table-action danger-link delete-icon-button"
                          type="button"
                          onClick={() => handleDelete(activity.id, activity.name)}
                          aria-label="Verwijderen"
                          title="Verwijderen"
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
      </div>

      {goalModal.open && (
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

            <div className="goal-select-filters">
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
                  {goalModal.subjects.map((subject) => (
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
            </div>

            <div className="goal-select-list">
              {goalModal.goals.length === 0 ? (
                <div className="empty-state compact">
                  <h3>Geen doelen gevonden</h3>
                  <p className="text-muted">Pas de filters aan.</p>
                </div>
              ) : (
                goalModal.goals.map((goal) => {
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
                              : [...current.tempSelectedItems, { goal_id: goal.id, observe: true }],
                          }))
                        }}
                      />
                      <span>
                        <strong>{goal.title || goal.code}</strong>
                        <span className="goal-metadata">
                          {' '}
                          {[goal.subject, goal.domain, goal.subdomain].filter(Boolean).join(' · ')}
                        </span>
                        <span className="goal-metadata"> {goal.goal_type}</span>
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
