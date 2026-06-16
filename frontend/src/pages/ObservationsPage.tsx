import { AxiosError } from 'axios'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import {
  createObservationGoal,
  deleteObservationGoal,
  getObservationGoalDomains,
  getObservationGoalSubjects,
  getObservationGoalSubdomains,
  getObservationGoals,
  searchOpStapGoals,
  GoalResponse,
  GoalSearchFilters,
  ObservationGoalResponse,
} from '../services/observations'

type ObservationGoalForm = {
  name: string
  subject: string
  domain: string
  subdomain: string
  goal_id: number | null
}

type GoalModalFilters = {
  subject: string
  domain: string
  subdomain: string
  q: string
}

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

const formatGoalLabel = (goal: (GoalResponse | { code: string; title: string }) | null | undefined) => {
  if (!goal) return 'Geen doel gekoppeld'
  return `${goal.code} - ${goal.title}`
}

const formatGoalPreview = (description: string | null) => {
  if (!description) return 'Geen omschrijving beschikbaar.'
  return description.length > 220 ? `${description.slice(0, 220)}...` : description
}

export default function ObservationsPage() {
  const [observationGoals, setObservationGoals] = useState<ObservationGoalResponse[]>([])
  const [subjects, setSubjects] = useState<string[]>([])
  const [domains, setDomains] = useState<string[]>([])
  const [modalDomains, setModalDomains] = useState<string[]>([])
  const [subdomains, setSubdomains] = useState<string[]>([])
  const [modalSubdomains, setModalSubdomains] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState<ObservationGoalForm>({
    name: '',
    subject: '',
    domain: '',
    subdomain: '',
    goal_id: null,
  })
  const [selectedGoalSnapshot, setSelectedGoalSnapshot] = useState<GoalResponse | null>(null)

  const [goalModalOpen, setGoalModalOpen] = useState(false)
  const [goalSearchFilters, setGoalSearchFilters] = useState<GoalModalFilters>({
    subject: '',
    domain: '',
    subdomain: '',
    q: '',
  })
  const [goalSearchResults, setGoalSearchResults] = useState<GoalResponse[]>([])
  const [searchingGoals, setSearchingGoals] = useState(false)
  const [goalError, setGoalError] = useState('')
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null)

  const loadObservationGoals = async (filters: { subject?: string; domain?: string; subdomain?: string } = {}) => {
    try {
      const data = await getObservationGoals({
        subject: filters.subject || form.subject || undefined,
        domain: filters.domain || form.domain || undefined,
        subdomain: filters.subdomain || form.subdomain || undefined,
      })
      setObservationGoals(data)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err, 'Kan observatiedoelen niet laden.'))
    }
  }

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [subjectsData, goalsData] = await Promise.all([
          getObservationGoalSubjects(),
          getObservationGoals(),
        ])
        setSubjects(subjectsData)
        setObservationGoals(goalsData)
        setError('')
      } catch (err) {
        setError(getErrorMessage(err, 'Kan gegevens niet laden.'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    const load = async () => {
      if (!form.subject) {
        setDomains([])
        setSubdomains([])
        return
      }

      try {
        const [domainsData, subdomainsData] = await Promise.all([
          getObservationGoalDomains(form.subject),
          getObservationGoalSubdomains(form.subject),
        ])
        setDomains(domainsData)
        setSubdomains(subdomainsData)

        if (form.domain && !domainsData.includes(form.domain)) {
          setForm((current) => ({ ...current, domain: '', subdomain: '' }))
          return
        }

        if (form.subdomain && !subdomainsData.includes(form.subdomain)) {
          setForm((current) => ({ ...current, subdomain: '' }))
        }
      } catch (err) {
        setGoalError(getErrorMessage(err, 'Kan domeinen of subdomeinen niet laden.'))
      }
    }
    load()
  }, [form.subject])

  useEffect(() => {
    const load = async () => {
      if (!form.subject) {
        setSubdomains([])
        return
      }

      try {
        const data = await getObservationGoalSubdomains(form.subject, form.domain || undefined)
        setSubdomains(data)
        if (form.subdomain && !data.includes(form.subdomain)) {
          setForm((current) => ({ ...current, subdomain: '' }))
        }
      } catch (err) {
        setGoalError(getErrorMessage(err, 'Kan subdomeinen niet laden.'))
      }
    }
    load()
  }, [form.subject, form.domain])

  useEffect(() => {
    const load = async () => {
      try {
        const [domainsData, subdomainsData] = await Promise.all([
          getObservationGoalDomains(goalSearchFilters.subject || undefined),
          getObservationGoalSubdomains(
            goalSearchFilters.subject || undefined,
            goalSearchFilters.domain || undefined,
          ),
        ])
        setModalDomains(domainsData)
        setModalSubdomains(subdomainsData)

        if (goalSearchFilters.domain && !domainsData.includes(goalSearchFilters.domain)) {
          setGoalSearchFilters((current) => ({ ...current, domain: '', subdomain: '' }))
          return
        }

        if (goalSearchFilters.subdomain && !subdomainsData.includes(goalSearchFilters.subdomain)) {
          setGoalSearchFilters((current) => ({ ...current, subdomain: '' }))
        }
      } catch (err) {
        setGoalError(getErrorMessage(err, 'Kan domeinen of subdomeinen niet laden.'))
      }
    }
    load()
  }, [goalSearchFilters.subject, goalSearchFilters.domain])

  useEffect(() => {
    loadObservationGoals()
  }, [form.subject, form.domain, form.subdomain])

  const searchGoals = useCallback(async (filters: GoalModalFilters) => {
    const params: GoalSearchFilters = {
      subject: filters.subject || undefined,
      domain: filters.domain || undefined,
      subdomain: filters.subdomain || undefined,
    }
    const text = filters.q.trim()
    if (text.length >= 2) {
      params.q = text
    }

    try {
      setSearchingGoals(true)
      setGoalError('')
      const data = await searchOpStapGoals(params)
      setGoalSearchResults(data)
    } catch (err) {
      setGoalError(getErrorMessage(err, 'Kan Op Stap doelen niet zoeken.'))
    } finally {
      setSearchingGoals(false)
    }
  }, [])

  useEffect(() => {
    if (!goalModalOpen) {
      return
    }

    const timeout = window.setTimeout(() => {
      searchGoals(goalSearchFilters)
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [goalModalOpen, goalSearchFilters, searchGoals])

  const handleOpenGoalModal = () => {
    const initialFilters = {
      subject: form.subject,
      domain: form.domain,
      subdomain: form.subdomain,
      q: form.name.trim().length >= 2 ? form.name.trim() : '',
    }
    setGoalSearchFilters(initialFilters)
    setGoalSearchResults([])
    setSelectedGoalId(form.goal_id)
    setGoalError('')
    setGoalModalOpen(true)
  }

  const handleConfirmGoalSelection = () => {
    const selectedGoal = goalSearchResults.find((goal) => goal.id === selectedGoalId)
    if (!selectedGoal) {
      setGoalError('Selecteer eerst een Op Stap doel.')
      return
    }

    setForm((current) => ({
      ...current,
      name: current.name.trim() || selectedGoal.title,
      goal_id: selectedGoal.id,
    }))
    setSelectedGoalSnapshot(selectedGoal)
    setSuccess(`Doel ${selectedGoal.code} gekoppeld aan het observatiedoel.`)
    setGoalModalOpen(false)
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.subject || !form.domain || !form.subdomain) {
      setError('Kies een vak, domein en subdomein.')
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')
      await createObservationGoal({
        name: form.name,
        subject: form.subject,
        domain: form.domain,
        subdomain: form.subdomain,
        goal_id: form.goal_id ?? undefined,
      })
      setForm({ name: '', subject: '', domain: '', subdomain: '', goal_id: null })
      setSelectedGoalSnapshot(null)
      setSuccess('Observatiedoel is aangemaakt.')
      await loadObservationGoals()
    } catch (err) {
      setError(getErrorMessage(err, 'Kan observatiedoel niet aanmaken.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Wil je dit observatiedoel echt verwijderen?')) {
      return
    }

    try {
      setError('')
      setSuccess('')
      await deleteObservationGoal(id)
      setSuccess('Observatiedoel is verwijderd.')
      await loadObservationGoals()
    } catch (err) {
      setError(getErrorMessage(err, 'Kan observatiedoel niet verwijderen.'))
    }
  }

  const selectedGoal = selectedGoalSnapshot ?? goalSearchResults.find((goal) => goal.id === form.goal_id)

  return (
    <>
      <section className="page-header">
        <div>
          <h1>Observaties</h1>
          <p className="text-muted">Definieer hier wat je wilt observeren en koppel eventueel een Op Stap doel.</p>
        </div>
      </section>

      {error && <div className="inline-message inline-message-error">{error}</div>}
      {success && <div className="inline-message inline-message-success">{success}</div>}

      <div className="management-grid observations-grid">
        <section className="form-card card">
          <h2>Observatiedoel aanmaken</h2>
          <p className="text-muted">Naam, vak en subdomein zijn verplicht. Een Op Stap doel koppelen is optioneel.</p>

          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label htmlFor="observation-goal-name">Naam</label>
              <input
                id="observation-goal-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Bijvoorbeeld: Lezen"
              />
            </div>

            <div className="form-group">
              <label htmlFor="observation-goal-subject">Vak</label>
              <select
                id="observation-goal-subject"
                value={form.subject}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    subject: event.target.value,
                    domain: '',
                    subdomain: '',
                    goal_id: null,
                  }))
                  setSelectedGoalSnapshot(null)
                }}
              >
                <option value="">Kies vak</option>
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="observation-goal-domain">Domein</label>
              <select
                id="observation-goal-domain"
                value={form.domain}
                disabled={!form.subject}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    domain: event.target.value,
                    subdomain: '',
                    goal_id: null,
                  }))
                  setSelectedGoalSnapshot(null)
                }}
              >
                <option value="">Kies domein</option>
                {domains.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="observation-goal-subdomain">Subdomein</label>
              <select
                id="observation-goal-subdomain"
                value={form.subdomain}
                disabled={!form.subject}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    subdomain: event.target.value,
                    goal_id: null,
                  }))
                  setSelectedGoalSnapshot(null)
                }}
              >
                <option value="">Kies subdomein</option>
                {subdomains.map((subdomain) => (
                  <option key={subdomain} value={subdomain}>
                    {subdomain}
                  </option>
                ))}
              </select>
            </div>

            <button className="btn btn-outline btn-full" type="button" onClick={handleOpenGoalModal}>
              Zoek Op Stap doel
            </button>

            {selectedGoal && (
              <div className="selected-goal-card">
                <strong>{selectedGoal.code}</strong>
                <span>{selectedGoal.title}</span>
                <span className="goal-metadata">
                  {[selectedGoal.subject, selectedGoal.domain, selectedGoal.subdomain, selectedGoal.cluster]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <button
                  className="link-button"
                  type="button"
                  onClick={() => {
                    setForm((current) => ({ ...current, goal_id: null }))
                    setSelectedGoalSnapshot(null)
                  }}
                >
                  Koppeling verwijderen
                </button>
              </div>
            )}

            <button className="btn btn-primary btn-full" type="submit" disabled={saving}>
              {saving ? 'Aanmaken...' : 'Observatiedoel aanmaken'}
            </button>
          </form>
        </section>

        <section className="table-card">
          <div className="table-header">
            <div>
              <h2>Gedefinieerde observatiedoelen</h2>
              <p className="text-muted">Deze doelen kunnen later gebruikt worden om effectieve observaties mee te doen.</p>
            </div>
            <span className="count-pill">{observationGoals.length}</span>
          </div>

          {loading ? (
            <div className="empty-state compact">Observatiedoelen laden...</div>
          ) : observationGoals.length === 0 ? (
            <div className="empty-state compact">
              <h3>Geen observatiedoelen</h3>
              <p className="text-muted">Maak links een observatiedoel aan om hier een overzicht te zien.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Naam</th>
                    <th>Vak</th>
                    <th>Domein</th>
                    <th>Subdomein</th>
                    <th>Gekoppeld Op Stap doel</th>
                    <th>Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {observationGoals.map((goal) => (
                    <tr key={goal.id}>
                      <td>
                        <strong>{goal.name}</strong>
                      </td>
                      <td>{goal.subject}</td>
                      <td>{goal.domain}</td>
                      <td>{goal.subdomain}</td>
                      <td>{formatGoalLabel(goal.goal)}</td>
                      <td>
                        <button className="table-action danger-link" type="button" onClick={() => handleDelete(goal.id)}>
                          Verwijderen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {goalModalOpen && (
        <div className="modal-backdrop">
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="goal-modal-title">
            <div className="modal-header">
              <div>
                <h2 id="goal-modal-title">Kies een Op Stap doel</h2>
                <p className="text-muted">Filter op vak, subdomein en omschrijving. De tekstfilter werkt vanaf 2 tekens.</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setGoalModalOpen(false)} aria-label="Sluiten">
                ✕
              </button>
            </div>

            <div className="goal-modal-filters">
              <div className="form-group">
                <label htmlFor="goal-modal-subject">Vak</label>
                <select
                  id="goal-modal-subject"
                  value={goalSearchFilters.subject}
                  onChange={(event) =>
                    setGoalSearchFilters((current) => ({
                      ...current,
                      subject: event.target.value,
                      subdomain: '',
                    }))
                  }
                >
                  <option value="">Alle vakken</option>
                  {subjects.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="goal-modal-domain">Domein</label>
                <select
                  id="goal-modal-domain"
                  value={goalSearchFilters.domain}
                  disabled={!goalSearchFilters.subject}
                  onChange={(event) =>
                    setGoalSearchFilters((current) => ({
                      ...current,
                      domain: event.target.value,
                      subdomain: '',
                    }))
                  }
                >
                  <option value="">Alle domeinen</option>
                  {modalDomains.map((domain) => (
                    <option key={domain} value={domain}>
                      {domain}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="goal-modal-subdomain">Subdomein</label>
                <select
                  id="goal-modal-subdomain"
                  value={goalSearchFilters.subdomain}
                  onChange={(event) => setGoalSearchFilters((current) => ({ ...current, subdomain: event.target.value }))}
                >
                  <option value="">Alle subdomeinen</option>
                  {modalSubdomains.map((subdomain) => (
                    <option key={subdomain} value={subdomain}>
                      {subdomain}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="goal-modal-q">Zoek in omschrijving</label>
                <input
                  id="goal-modal-q"
                  value={goalSearchFilters.q}
                  onChange={(event) => setGoalSearchFilters((current) => ({ ...current, q: event.target.value }))}
                  placeholder="Typ minstens 2 tekens"
                />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-primary" type="button" onClick={() => searchGoals(goalSearchFilters)}>
                Zoeken
              </button>
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => {
                  setGoalSearchFilters({ subject: form.subject, domain: form.domain, subdomain: form.subdomain, q: '' })
                  setSelectedGoalId(null)
                  setGoalError('')
                }}
              >
                Filters wissen
              </button>
              <button className="btn btn-outline" type="button" onClick={() => setGoalModalOpen(false)}>
                Annuleren
              </button>
            </div>

            {goalError && <div className="inline-message inline-message-error">{goalError}</div>}

            {searchingGoals ? (
              <div className="empty-state compact">Op Stap doelen zoeken...</div>
            ) : goalSearchResults.length === 0 ? (
              <div className="empty-state compact">
                <h3>Geen doelen gevonden</h3>
                <p className="text-muted">Pas de filters aan of typ minstens 2 tekens om te zoeken in de omschrijving.</p>
              </div>
            ) : (
              <div className="goal-results">
                {goalSearchResults.map((goal) => (
                  <label className={`goal-option ${selectedGoalId === goal.id ? 'selected' : ''}`} key={goal.id}>
                    <input
                      type="radio"
                      name="opstap-goal"
                      checked={selectedGoalId === goal.id}
                      onChange={() => setSelectedGoalId(goal.id)}
                    />
                    <div>
                      <strong>
                        {goal.code} - {goal.title}
                      </strong>
                      <span className="goal-metadata">
                        {[goal.subject, goal.domain, goal.subdomain, goal.cluster].filter(Boolean).join(' · ')}
                      </span>
                      <span>{formatGoalPreview(goal.description)}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-outline" type="button" onClick={() => setGoalModalOpen(false)}>
                Sluiten
              </button>
              <button className="btn btn-primary" type="button" onClick={handleConfirmGoalSelection} disabled={!selectedGoalId}>
                Doel koppelen
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
