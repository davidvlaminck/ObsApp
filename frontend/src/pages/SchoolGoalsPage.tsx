import { AxiosError } from 'axios'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { FormEvent, useEffect, useState } from 'react'
import {
  createManagedDomain,
  createObservationGoal,
  deleteManagedDomain,
  deleteObservationGoal,
  getManagedDomains,
  getObservationGoalClasses,
  getObservationGoalDomains,
  getObservationGoals,
  updateManagedDomain,
  ClassOption,
  ObservationGoalResponse,
  SchoolGoalDomainResponse,
} from '../services/observations'

type GoalForm = {
  name: string
  domain: string
  class_id: number | null
}

type GroupedGoals = Record<string, ObservationGoalResponse[]>

const SCHOOL_GOALS_SUBJECT = 'Schooleigen doelen'

const getErrorMessage = (error: unknown, fallback: string) => {
  const axiosError = error as AxiosError<{ detail?: string }>
  const status = axiosError.response?.status
  const detail = axiosError.response?.data?.detail

  if (status === 401) {
    return 'Sessie verlopen. Log opnieuw in.'
  }

  if (status === 403) {
    return 'Geen toegang.'
  }

  return detail ?? fallback
}

export default function SchoolGoalsPage() {
  const [goals, setGoals] = useState<ObservationGoalResponse[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [allDomains, setAllDomains] = useState<string[]>([])
  const [managedDomains, setManagedDomains] = useState<SchoolGoalDomainResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [domainSaving, setDomainSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState<GoalForm>({
    name: '',
    domain: '',
    class_id: null,
  })

  const [newDomainName, setNewDomainName] = useState('')
  const [editingDomainId, setEditingDomainId] = useState<number | null>(null)
  const [editingDomainName, setEditingDomainName] = useState('')

  const availableDomains = Array.from(new Set([...managedDomains.map((d) => d.name), ...allDomains])).sort((a, b) =>
    a.localeCompare(b),
  )

  const loadGoals = async () => {
    try {
      const data = await getObservationGoals({ subject: SCHOOL_GOALS_SUBJECT })
      setGoals(data)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err, 'Kan schooleigen doelen niet laden.'))
    }
  }

  const loadDomains = async () => {
    try {
      const [allDomainsData, managedDomainsData] = await Promise.all([
        getObservationGoalDomains(SCHOOL_GOALS_SUBJECT),
        getManagedDomains(),
      ])
      setAllDomains(allDomainsData)
      setManagedDomains(managedDomainsData)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err, 'Kan domeinen niet laden.'))
    }
  }

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [classesData] = await Promise.all([getObservationGoalClasses()])
        setClasses(classesData)
        await Promise.all([loadDomains(), loadGoals()])
      } catch (err) {
        setError(getErrorMessage(err, 'Kan gegevens niet laden.'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleCreateDomain = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = newDomainName.trim()
    if (!trimmed) {
      setError('Geen domeinnaam ingevuld.')
      return
    }

    try {
      setDomainSaving(true)
      setError('')
      setSuccess('')
      const created = await createManagedDomain(trimmed)
      setManagedDomains((current) => [...current, created])
      setNewDomainName('')
      setSuccess(`Domein "${trimmed}" is toegevoegd.`)
    } catch (err: any) {
      setError(getErrorMessage(err, 'Kan domein niet toevoegen.'))
    } finally {
      setDomainSaving(false)
    }
  }

  const startEditDomain = (domain: SchoolGoalDomainResponse) => {
    setEditingDomainId(domain.id)
    setEditingDomainName(domain.name)
  }

  const cancelEditDomain = () => {
    setEditingDomainId(null)
    setEditingDomainName('')
  }

  const saveEditDomain = async (id: number) => {
    const trimmed = editingDomainName.trim()
    if (!trimmed) {
      setError('Geen domeinnaam ingevuld.')
      return
    }

    try {
      setDomainSaving(true)
      setError('')
      setSuccess('')
      const updated = await updateManagedDomain(id, trimmed)
      setManagedDomains((current) => current.map((d) => (d.id === id ? updated : d)))
      cancelEditDomain()
      setSuccess(`Domein is bijgewerkt.`)
    } catch (err: any) {
      setError(getErrorMessage(err, 'Kan domein niet bijwerken.'))
    } finally {
      setDomainSaving(false)
    }
  }

  const handleDeleteDomain = async (id: number, name: string) => {
    if (!window.confirm(`Domein "${name}" verwijderen?`)) {
      return
    }

    try {
      setDomainSaving(true)
      setError('')
      setSuccess('')
      await deleteManagedDomain(id)
      setManagedDomains((current) => current.filter((d) => d.id !== id))
      setSuccess(`Domein "${name}" is verwijderd.`)
    } catch (err) {
      setError(getErrorMessage(err, 'Kan domein niet verwijderen.'))
    } finally {
      setDomainSaving(false)
    }
  }

  const handleGoalSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.name.trim() || !form.domain) {
      setError('Naam en domein zijn verplicht.')
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')
      await createObservationGoal({
        name: form.name.trim(),
        subject: SCHOOL_GOALS_SUBJECT,
        domain: form.domain,
        subdomain: null,
        goal_id: null,
        class_id: form.class_id ?? undefined,
      })
      setForm({ name: '', domain: '', class_id: null })
      setSuccess('Schooleigen doel is aangemaakt.')
      await loadGoals()
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError(err.response?.data?.detail || 'Limiet bereikt.')
      } else {
        setError(getErrorMessage(err, 'Kan schooleigen doel niet aanmaken.'))
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteGoal = async (id: number) => {
    if (!window.confirm('Wil je dit schooleigen doel echt verwijderen?')) {
      return
    }

    try {
      setError('')
      setSuccess('')
      await deleteObservationGoal(id)
      setSuccess('Schooleigen doel is verwijderd.')
      await loadGoals()
    } catch (err) {
      setError(getErrorMessage(err, 'Kan schooleigen doel niet verwijderen.'))
    }
  }

  const groupedByDomain = goals.reduce<GroupedGoals>((acc, goal) => {
    const domain = goal.domain || 'Zonder domein'
    if (!acc[domain]) {
      acc[domain] = []
    }
    acc[domain].push(goal)
    return acc
  }, {})

  const sortedDomains = Object.keys(groupedByDomain).sort((a, b) => a.localeCompare(b))

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
          <h1>Schooleigen doelen</h1>
          <p className="text-muted">Beheer je eigen schooldoelen naast de officiële doelen.</p>
        </div>
      </section>

      {error && <div className="inline-message inline-message-error">{error}</div>}
      {success && <div className="inline-message inline-message-success">{success}</div>}

      <div className="management-grid">
        <section className="form-card card">
          <h2>Domeinen beheren</h2>
          <p className="text-muted">Beheer de domeinen die je bij schooleigen doelen kunt gebruiken.</p>

          <div style={{ marginBottom: 16 }}>
            {managedDomains.length === 0 ? (
              <div className="empty-state compact">
                <h3>Geen domeinen</h3>
                <p className="text-muted">Voeg hieronder je eerste domein toe.</p>
              </div>
            ) : (
              <div className="user-list">
                {managedDomains.map((domain) => (
                  <div key={domain.id} className="user-item">
                    <div>
                      {editingDomainId === domain.id ? (
                        <input
                          type="text"
                          value={editingDomainName}
                          onChange={(e) => setEditingDomainName(e.target.value)}
                          onBlur={() => saveEditDomain(domain.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              saveEditDomain(domain.id)
                            }
                            if (e.key === 'Escape') {
                              e.preventDefault()
                              cancelEditDomain()
                            }
                          }}
                          autoFocus
                          disabled={domainSaving}
                          style={{ fontSize: 14, padding: '4px 8px', width: '100%', maxWidth: 320 }}
                        />
                      ) : (
                        <strong>{domain.name}</strong>
                      )}
                    </div>
                    <div className="domain-actions">
                      {editingDomainId === domain.id ? (
                        <>
                          <button
                            className="btn btn-sm btn-primary"
                            type="button"
                            onClick={() => saveEditDomain(domain.id)}
                            disabled={domainSaving}
                          >
                            Opslaan
                          </button>
                          <button
                            className="btn btn-sm btn-secondary"
                            type="button"
                            onClick={cancelEditDomain}
                            disabled={domainSaving}
                          >
                            Annuleren
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="table-action edit-icon-button"
                            type="button"
                            onClick={() => startEditDomain(domain)}
                            aria-label={`Bewerk ${domain.name}`}
                            title="Bewerken"
                            disabled={domainSaving}
                          >
                            <EditIcon fontSize="small" aria-hidden="true" />
                          </button>
                          <button
                            className="table-action danger-link delete-icon-button"
                            type="button"
                            onClick={() => handleDeleteDomain(domain.id, domain.name)}
                            aria-label={`Verwijder ${domain.name}`}
                            title="Verwijderen"
                            disabled={domainSaving}
                          >
                            <DeleteIcon fontSize="small" aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleCreateDomain}>
            <div className="form-group">
              <label htmlFor="new-domain-name">Nieuw domein</label>
              <input
                id="new-domain-name"
                value={newDomainName}
                onChange={(event) => setNewDomainName(event.target.value)}
                placeholder="Bijv. Sociale vaardigheden"
                disabled={domainSaving}
              />
            </div>
            <button className="btn btn-primary btn-full" type="submit" disabled={domainSaving}>
              {domainSaving ? 'Opslaan...' : 'Domein toevoegen'}
            </button>
          </form>
        </section>

        <section className="form-card card">
          <h2>Nieuw schooleigen doel</h2>
          <p className="text-muted">Kies een domein en voeg een doel toe.</p>

          <form onSubmit={handleGoalSubmit}>
            <div className="form-group">
              <label htmlFor="school-goal-name">Naam</label>
              <input
                id="school-goal-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Bijvoorbeeld: Teamwerk"
                required
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label htmlFor="school-goal-domain">Domein</label>
              <select
                id="school-goal-domain"
                value={form.domain}
                onChange={(event) => setForm((current) => ({ ...current, domain: event.target.value }))}
                disabled={saving || availableDomains.length === 0}
                required
              >
                <option value="">Kies domein</option>
                {availableDomains.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain}
                  </option>
                ))}
              </select>
              {availableDomains.length === 0 && (
                <p className="text-muted" style={{ marginTop: 4, fontSize: 13 }}>
                  Voeg eerst een domein toe in de kaart links.
                </p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="school-goal-class">Klas (optioneel)</label>
              <select
                id="school-goal-class"
                value={form.class_id ?? ''}
                onChange={(event) => {
                  const value = event.target.value
                  setForm((current) => ({
                    ...current,
                    class_id: value ? Number(value) : null,
                  }))
                }}
                disabled={saving}
              >
                <option value="">Alle klassen</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} ({cls.class_type})
                  </option>
                ))}
              </select>
            </div>

            <button className="btn btn-primary btn-full" type="submit" disabled={saving || availableDomains.length === 0}>
              {saving ? 'Opslaan...' : 'Doel toevoegen'}
            </button>
          </form>
        </section>

        <section className="table-card">
          <div className="table-header">
            <div>
              <h2>Overzicht</h2>
              <p className="text-muted">{goals.length === 0 ? 'Nog geen schooleigen doelen.' : ''}</p>
            </div>
            <span className="count-pill">{goals.length}</span>
          </div>

          {goals.length === 0 ? (
            <div className="empty-state compact">
              <h3>Geen schooleigen doelen</h3>
              <p className="text-muted">Voeg links je eerste schooleigen doel toe.</p>
            </div>
          ) : (
            sortedDomains.map((domain) => (
              <div key={domain} style={{ marginBottom: 24 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                    padding: '10px 14px',
                    background: 'var(--md-surface-hover)',
                    borderRadius: 'var(--md-radius-sm)',
                    border: '1px solid var(--md-border-light)',
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{domain}</h3>
                  <span style={{ fontSize: 12, color: 'var(--md-text-secondary)' }}>
                    {groupedByDomain[domain].length} doel{groupedByDomain[domain].length !== 1 ? 'en' : ''}
                  </span>
                </div>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Naam</th>
                        <th>Klas</th>
                        <th>Acties</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedByDomain[domain].map((goal) => {
                        const cls = classes.find((c) => c.id === goal.class_id)
                        return (
                          <tr key={goal.id}>
                            <td>
                              <strong>{goal.name}</strong>
                            </td>
                            <td>{cls ? `${cls.name} (${cls.class_type})` : 'Alle klassen'}</td>
                            <td>
                              <button
                                className="table-action danger-link delete-icon-button"
                                type="button"
                                onClick={() => handleDeleteGoal(goal.id)}
                                aria-label={`Verwijder ${goal.name}`}
                                title="Verwijderen"
                              >
                                <DeleteIcon fontSize="small" aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  )
}
