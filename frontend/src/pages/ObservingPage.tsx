import { AxiosError } from 'axios'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { StudentAvatar } from '../components/StudentAvatar'
import { sortSubjects, sortClasses } from '../lib/subjectSort'
import {
  getClasses,
  getMe,
  getSchoolYears,
  type ClassResponse,
  type StudentResponse,
  type UserResponse,
} from '../services/auth'
import {
  createStudentObservation,
  getObservationContext,
  getObservationGoalDomains,
  getObservationGoalSubdomains,
  getObservationGoalSubjects,
  getObservationGoals,
  listStudentObservations,
  type ObservationContextResponse,
  type ObservationGoalResponse,
  type ObservationStatus,
  type StudentObservationResponse,
  type StudentObservationStatusResponse,
} from '../services/observations'

type ObservationForm = {
  status: ObservationStatus | ''
  observation_date: string
  comment: string
}

type ObservationModalState = {
  student: StudentResponse
  goal: ObservationGoalResponse
}

type GoalModalState = {
  open: boolean
  subject: string
  domain: string
  subdomain: string
  goals: ObservationGoalResponse[]
  tempSelectedIds: number[]
  domains: string[]
  subdomains: string[]
}

const today = new Date().toISOString().slice(0, 10)

const statusOptions: Array<{ value: ObservationStatus; label: string; description: string; color: string }> = [
  {
    value: 'onvoldoende',
    label: 'Onvoldoende',
    description: 'De leerling bereikt het doel nog niet.',
    color: 'red',
  },
  {
    value: 'in_ontwikkeling',
    label: 'In ontwikkeling',
    description: 'De leerling is bezig het doel onder de knie te krijgen.',
    color: 'orange',
  },
  {
    value: 'zelfstandig',
    label: 'Zelfstandig',
    description: 'De leerling kan het doel zelfstandig toepassen.',
    color: 'green',
  },
  {
    value: 'voorsprong',
    label: 'Voorsprong in ontwikkeling',
    description: 'De leerling gaat verder dan het verwachte niveau.',
    color: 'blue',
  },
]

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

const getStudentObservationLabel = (status?: ObservationStatus) => {
  switch (status) {
    case 'onvoldoende':
      return 'Laatste status: onvoldoende'
    case 'in_ontwikkeling':
      return 'Laatste status: in ontwikkeling'
    case 'zelfstandig':
      return 'Laatste status: zelfstandig'
    case 'voorsprong':
      return 'Laatste status: voorsprong in ontwikkeling'
    default:
      return 'Klik om te observeren'
  }
}

const isObservationNewer = (a: StudentObservationResponse, b: StudentObservationStatusResponse) => {
  const dateComparison = a.observation_date.localeCompare(b.observation_date)
  if (dateComparison !== 0) return dateComparison > 0

  return a.id > b.id
}

export default function ObservingPage() {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<ClassResponse[]>([])
  const [subjects, setSubjects] = useState<string[]>([])
  const [context, setContext] = useState<ObservationContextResponse>({
    goals: [],
    students: [],
    student_observations: {},
    class_info: null,
  })
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null)
  const [selectedGoals, setSelectedGoals] = useState<ObservationGoalResponse[]>([])
  const [allObservations, setAllObservations] = useState<StudentObservationResponse[]>([])
  const [observationModal, setObservationModal] = useState<ObservationModalState | null>(null)
  const [infoGoal, setInfoGoal] = useState<ObservationGoalResponse | null>(null)
  const [form, setForm] = useState<ObservationForm>({ status: '', observation_date: today, comment: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkStatus, setBulkStatus] = useState<ObservationStatus | ''>('')
  const [bulkSaving, setBulkSaving] = useState(false)

  const [goalModal, setGoalModal] = useState<GoalModalState>({
    open: false,
    subject: '',
    domain: '',
    subdomain: '',
    goals: [],
    tempSelectedIds: [],
    domains: [],
    subdomains: [],
  })

  const selectedGoalIds = useMemo(() => new Set(selectedGoals.map((g) => g.id)), [selectedGoals])
  const studentIds = useMemo(() => new Set(context.students.map((s) => s.id)), [context.students])

  const observationMap = useMemo(() => {
    const map = new Map<number, Map<number, StudentObservationStatusResponse>>()

    for (const obs of allObservations) {
      if (!selectedGoalIds.has(obs.observation_goal_id)) continue
      if (!studentIds.has(obs.student_id)) continue

      const goalMap = map.get(obs.observation_goal_id) ?? new Map()
      const existing = goalMap.get(obs.student_id)
      if (!existing || isObservationNewer(obs, existing)) {
        goalMap.set(obs.student_id, {
          id: obs.id,
          observation_goal_id: obs.observation_goal_id,
          student_id: obs.student_id,
          status: obs.status,
          observation_date: obs.observation_date,
          comment: obs.comment,
        })
      }
      map.set(obs.observation_goal_id, goalMap)
    }

    return map
  }, [allObservations, selectedGoalIds, studentIds])

  useEffect(() => {
    const loadUserAndClasses = async () => {
      try {
        setLoading(true)
        const currentUser = await getMe()
        setUser(currentUser)

        if (currentUser.is_superuser || !currentUser.school_id) {
          return
        }

        const schoolYears = await getSchoolYears(currentUser.school_id)
        const activeSchoolYear = schoolYears.find((schoolYear) => schoolYear.is_active) ?? schoolYears[0] ?? null
        if (activeSchoolYear) {
          const loadedClasses = sortClasses(await getClasses(activeSchoolYear.id))
          setClasses(loadedClasses)

          if (currentUser.default_class_id) {
            setSelectedClassId(currentUser.default_class_id)
          } else if (loadedClasses.length === 1) {
            setSelectedClassId(loadedClasses[0].id)
          }
        }

        setSubjects(await getObservationGoalSubjects())
      } catch (err) {
        setError(getErrorMessage(err, 'Kan startgegevens niet laden.'))
      } finally {
        setLoading(false)
      }
    }

    loadUserAndClasses()
  }, [])

  useEffect(() => {
    const loadModalDomains = async () => {
      if (!goalModal.subject) {
        setGoalModal((current) => ({ ...current, domains: [], subdomains: [] }))
        return
      }

      try {
        const [domainsData, subdomainsData] = await Promise.all([
          getObservationGoalDomains(goalModal.subject),
          getObservationGoalSubdomains(goalModal.subject),
        ])
        setGoalModal((current) => ({ ...current, domains: domainsData, subdomains: subdomainsData }))
      } catch (err) {
        setError(getErrorMessage(err, 'Kan domeinen of subdomeinen niet laden.'))
      }
    }

    loadModalDomains()
  }, [goalModal.subject])

  useEffect(() => {
    const loadModalSubdomains = async () => {
      if (!goalModal.subject) {
        setGoalModal((current) => ({ ...current, subdomains: [] }))
        return
      }

      try {
        const data = await getObservationGoalSubdomains(goalModal.subject, goalModal.domain || undefined)
        setGoalModal((current) => ({ ...current, subdomains: data }))
      } catch (err) {
        setError(getErrorMessage(err, 'Kan subdomeinen niet laden.'))
      }
    }

    loadModalSubdomains()
  }, [goalModal.subject, goalModal.domain])

  useEffect(() => {
    const loadModalGoals = async () => {
      if (!goalModal.open) return

      try {
        const data = await getObservationGoals({
          subject: goalModal.subject || undefined,
          domain: goalModal.domain || undefined,
          subdomain: goalModal.subdomain || undefined,
        })
        setGoalModal((current) => ({ ...current, goals: data }))
      } catch (err) {
        setError(getErrorMessage(err, 'Kan observatiedoelen niet laden.'))
      }
    }

    loadModalGoals()
  }, [goalModal.open, goalModal.subject, goalModal.domain, goalModal.subdomain])

  useEffect(() => {
    const loadObservations = async () => {
      if (!selectedClassId) {
        setAllObservations([])
        return
      }

      try {
        const data = await listStudentObservations()
        setAllObservations(data)
      } catch (err) {
        setError(getErrorMessage(err, 'Kan observaties niet laden.'))
      }
    }

    loadObservations()
  }, [selectedClassId])

  const loadContext = useCallback(async () => {
    if (!user || user.is_superuser || !user.school_id) {
      return
    }

    try {
      setError('')
      const data = await getObservationContext({
        class_id: selectedClassId || undefined,
      })
      setContext(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Kan observatiecontext niet laden.'))
    }
  }, [selectedClassId, user])

  useEffect(() => {
    loadContext()
  }, [loadContext])

  useEffect(() => {
    if (context.goals.length === 0) return
    const availableIds = new Set(context.goals.map((g) => g.id))
    setSelectedGoals((current) => current.filter((g) => availableIds.has(g.id)))
  }, [context.goals])

  const openGoalModal = useCallback(() => {
    setGoalModal({
      open: true,
      subject: '',
      domain: '',
      subdomain: '',
      goals: [],
      tempSelectedIds: selectedGoals.map((g) => g.id),
      domains: [],
      subdomains: [],
    })
  }, [selectedGoals])

  const closeGoalModal = useCallback(() => {
    setGoalModal((current) => ({ ...current, open: false }))
  }, [])

  const confirmGoalSelection = useCallback(() => {
    const newGoals = goalModal.goals.filter((g) => goalModal.tempSelectedIds.includes(g.id))
    setSelectedGoals(newGoals)
    setSuccess('')
    closeGoalModal()
  }, [goalModal, closeGoalModal])

  const removeGoal = useCallback((goalId: number) => {
    setSelectedGoals((current) => current.filter((g) => g.id !== goalId))
  }, [])

  const toggleBulkMode = useCallback(() => {
    setBulkMode((current) => !current)
    setBulkStatus('')
  }, [])

  const exitBulkMode = useCallback(() => {
    setBulkMode(false)
    setBulkStatus('')
  }, [])

  const handleBulkStudentClick = useCallback(async (student: StudentResponse, goal: ObservationGoalResponse) => {
    if (!bulkStatus || bulkSaving) return

    try {
      setBulkSaving(true)
      setError('')
      await createStudentObservation({
        observation_goal_id: goal.id,
        student_id: student.id,
        status: bulkStatus,
        observation_date: today,
        comment: null,
      })
      setSuccess(`Bulk observatie opgeslagen voor ${student.name}.`)
      const observations = await listStudentObservations()
      setAllObservations(observations)
    } catch (err) {
      setError(getErrorMessage(err, 'Kan bulk observatie niet opslaan.'))
    } finally {
      setBulkSaving(false)
    }
  }, [bulkStatus, bulkSaving])

  const handleBulkGoalClick = useCallback(async (goal: ObservationGoalResponse) => {
    if (!bulkStatus || bulkSaving) return

    try {
      setBulkSaving(true)
      setError('')
      const promises = context.students.map((student) =>
        createStudentObservation({
          observation_goal_id: goal.id,
          student_id: student.id,
          status: bulkStatus,
          observation_date: today,
          comment: null,
        })
      )
      await Promise.all(promises)
      setSuccess(`Bulk observaties opgeslagen voor doel: ${goal.name}`)
      const observations = await listStudentObservations()
      setAllObservations(observations)
    } catch (err) {
      setError(getErrorMessage(err, 'Kan bulk observaties niet opslaan.'))
    } finally {
      setBulkSaving(false)
    }
  }, [bulkStatus, bulkSaving, context.students])

  const openObservationModal = (student: StudentResponse, goal: ObservationGoalResponse) => {
    setObservationModal({ student, goal })
    setForm({ status: '', observation_date: today, comment: '' })
    setFormError('')
  }

  const closeObservationModal = () => {
    setObservationModal(null)
    setFormError('')
  }

  const openGoalInfo = (goal: ObservationGoalResponse) => {
    setInfoGoal(goal)
  }

  const closeGoalInfo = () => {
    setInfoGoal(null)
  }

  const handleSaveObservation = async () => {
    if (!observationModal || !form.status || !form.observation_date) {
      setFormError('Kies een status en vul een datum in.')
      return
    }

    try {
      setSaving(true)
      setFormError('')
      const response: StudentObservationResponse = await createStudentObservation({
        observation_goal_id: observationModal.goal.id,
        student_id: observationModal.student.id,
        status: form.status,
        observation_date: form.observation_date,
        comment: form.comment.trim() || null,
      })
      setSuccess(`Observatie opgeslagen voor ${observationModal.student.name}.`)
      closeObservationModal()
      const observations = await listStudentObservations()
      setAllObservations(observations)
      return response
    } catch (err) {
      setFormError(getErrorMessage(err, 'Kan observatie niet opslaan.'))
      return undefined
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="empty-state compact">Gegevens laden...</div>
  }

  if (user?.is_superuser) {
    return (
      <>
        <section className="page-header">
          <div>
            <h1>Observeren</h1>
            <p className="text-muted">Voer observaties uit voor leerlingen op basis van bestaande observatiedoelen.</p>
          </div>
        </section>
        <div className="inline-message inline-message-error">
          Superusers moeten zich eerst als leerkracht identificeren voordat ze leerlingen kunnen observeren.
        </div>
      </>
    )
  }

  return (
    <>
      <section className="page-header">
        <div>
          <h1>Observeren</h1>
          <p className="text-muted">Kies een klas en doel(en) om observaties per leerling vast te leggen.</p>
        </div>
      </section>

      {error && <div className="inline-message inline-message-error">{error}</div>}
      {success && <div className="inline-message inline-message-success">{success}</div>}

      <section className="observing-class-filter-card">
        <div className="observing-class-filter-header">
          <h2>Klas</h2>
          <div className="class-chips">
            <button
              type="button"
              className={`class-chip class-chip-all ${selectedClassId === null ? 'active' : ''}`}
              onClick={() => {
                setSelectedClassId(null)
                setSelectedGoals([])
                setSuccess('')
              }}
            >
              Alle
            </button>
            {classes.map((classItem, index) => (
              <button
                key={classItem.id}
                type="button"
                className={`class-chip class-chip-${index % 4} ${
                  selectedClassId === classItem.id ? 'active' : ''
                }`}
                onClick={() => {
                  setSelectedClassId(classItem.id)
                  setSelectedGoals([])
                  setSuccess('')
                }}
              >
                {classItem.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {selectedGoals.length > 0 && (
        <div className="selected-goals-bar">
          <div className="selected-goals-list">
            {selectedGoals.map((goal) => (
              <span key={goal.id} className="selected-goal-chip">
                <span className="selected-goal-chip-name">{goal.name}</span>
                <button
                  type="button"
                  className="selected-goal-chip-remove"
                  onClick={() => removeGoal(goal.id)}
                  aria-label={`Verwijder ${goal.name}`}
                >
                  ×
                </button>
                <button
                  type="button"
                  className="selected-goal-chip-info"
                  onClick={() => openGoalInfo(goal)}
                  aria-label={`Info over ${goal.name}`}
                >
                  ℹ
                </button>
              </span>
            ))}
          </div>
          <button className="btn btn-outline btn-sm" type="button" onClick={openGoalModal}>
            + Voeg observatiedoel toe
          </button>
        </div>
      )}

      {selectedGoals.length === 0 && (
        <div className="observing-add-goals-prompt">
          <button className="btn btn-primary" type="button" onClick={openGoalModal}>
            + Voeg observatiedoel toe
          </button>
          <p className="text-muted">Kies een of meer observatiedoelen om te beginnen.</p>
        </div>
      )}

      <div className="observing-layout">
        <section className="observing-panel observing-grid-panel">
          {selectedGoals.length === 0 ? (
            <div className="empty-state">
              <h3>Geen doelen geselecteerd</h3>
              <p className="text-muted">Kies een of meer observatiedoelen om de leerlingen te bekijken.</p>
            </div>
          ) : context.students.length === 0 ? (
            <div className="empty-state">
              <h3>Geen leerlingen geladen</h3>
              <p className="text-muted">Kies een klas om de leerlingen van die klas te tonen.</p>
            </div>
          ) : (
            <>
              <div className="observation-grid-toolbar">
                {!bulkMode ? (
                  <button className="btn btn-outline btn-sm" type="button" onClick={toggleBulkMode}>
                    Bulk observeren
                  </button>
                ) : (
                  <>
                    <div className="bulk-status-selector">
                      {statusOptions.map((status) => (
                        <button
                          key={status.value}
                          type="button"
                          className={`bulk-status-btn bulk-status-${status.color} ${bulkStatus === status.value ? 'active' : ''}`}
                          onClick={() => setBulkStatus(status.value)}
                          disabled={bulkSaving}
                        >
                          {status.label}
                        </button>
                      ))}
                    </div>
                    <button className="btn btn-outline btn-sm" type="button" onClick={exitBulkMode}>
                      Sluiten
                    </button>
                  </>
                )}
              </div>

              <div className="observation-grid-wrapper">
                <table className={`observation-grid ${bulkMode ? 'bulk-mode' : ''}`}>
                  <thead>
                    <tr>
                      <th className="observation-grid-header-student">Leerling</th>
                      {selectedGoals.map((goal) => (
                        <th
                          key={goal.id}
                          className={`observation-grid-header-goal ${bulkMode && bulkStatus ? 'bulk-clickable' : ''}`}
                          onClick={() => bulkMode && bulkStatus && handleBulkGoalClick(goal)}
                        >
                          <span className="observation-grid-goal-name">{goal.name}</span>
                          <span className="goal-metadata">
                            {[goal.subject, goal.domain, goal.subdomain].filter(Boolean).join(' · ')}
                          </span>
                          {bulkMode && bulkStatus && (
                            <span className="bulk-column-hint">Klik om hele kolom in te vullen</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {context.students.map((student) => {
                      const studentObservations = selectedGoals.map((goal) => ({
                        goal,
                        observation: observationMap.get(goal.id)?.get(student.id),
                      }))

                      return (
                        <tr key={student.id}>
                          <td className="observation-grid-cell-student">
                            <StudentAvatar student={student} />
                            <span>
                              <strong>{student.name}</strong>
                            </span>
                          </td>
                          {studentObservations.map(({ goal, observation }) => (
                            <td key={goal.id} className="observation-grid-cell-status">
                              <button
                                type="button"
                                className={`observation-cell ${observation ? `status-${observation.status}` : ''} ${bulkMode && bulkStatus ? 'bulk-clickable' : ''}`}
                                onClick={() =>
                                  bulkMode && bulkStatus
                                    ? handleBulkStudentClick(student, goal)
                                    : openObservationModal(student, goal)
                                }
                                disabled={bulkSaving}
                              >
                                {observation
                                  ? getStudentObservationLabel(observation.status)
                                  : 'Klik om te observeren'}
                              </button>
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      {goalModal.open && (
        <div className="modal-backdrop">
          <section className="modal-card goal-select-modal" role="dialog" aria-modal="true" aria-labelledby="goal-select-title">
            <div className="modal-header">
              <div>
                <h2 id="goal-select-title">Voeg observatiedoelen toe</h2>
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
                  {sortSubjects(subjects).map((subject) => (
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
                  <p className="text-muted">Pas de filters aan of maak eerst observatiedoelen aan onder Beheer.</p>
                </div>
              ) : (
                goalModal.goals.map((goal) => {
                  const isSelected = goalModal.tempSelectedIds.includes(goal.id)
                  const isAlreadyAdded = selectedGoalIds.has(goal.id)

                  return (
                    <label
                      key={goal.id}
                      className={`goal-select-item ${isSelected ? 'selected' : ''} ${isAlreadyAdded ? 'disabled' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isAlreadyAdded}
                        onChange={() => {
                          setGoalModal((current) => ({
                            ...current,
                            tempSelectedIds: isSelected
                              ? current.tempSelectedIds.filter((id) => id !== goal.id)
                              : [...current.tempSelectedIds, goal.id],
                          }))
                        }}
                      />
                      <span>
                        <strong>{goal.name}</strong>
                        <span className="goal-metadata">
                          {[goal.subject, goal.domain, goal.subdomain].filter(Boolean).join(' · ')}
                        </span>
                        <span className="goal-metadata">
                          {goal.goal?.code ? `Doelcode: ${goal.goal.code}` : 'Geen Op Stap doel gekoppeld'}
                        </span>
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
                disabled={goalModal.tempSelectedIds.length === 0}
              >
                Toevoegen ({goalModal.tempSelectedIds.length})
              </button>
            </div>
          </section>
        </div>
      )}

      {observationModal && (
        <div className="modal-backdrop">
          <section className="modal-card observation-form-modal" role="dialog" aria-modal="true" aria-labelledby="observation-form-title">
            <div className="modal-header">
              <div>
                <h2 id="observation-form-title">Observatie invoeren</h2>
                <p className="text-muted">
                  {observationModal.student.name} · {observationModal.goal.name}
                </p>
              </div>
              <button className="icon-button" type="button" onClick={closeObservationModal} aria-label="Sluiten">
                ✕
              </button>
            </div>

            {formError && <div className="inline-message inline-message-error">{formError}</div>}

            <div className="form-group">
              <label>Status</label>
              <div className="status-options">
                {statusOptions.map((status) => (
                  <label key={status.value} className={`status-option ${status.color} ${form.status === status.value ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="observation-status"
                      value={status.value}
                      checked={form.status === status.value}
                      onChange={() => setForm((current) => ({ ...current, status: status.value }))}
                    />
                    <span>
                      <strong>{status.label}</strong>
                      <small>{status.description}</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="observation-date">Datum</label>
              <input
                id="observation-date"
                type="date"
                value={form.observation_date}
                onChange={(event) => setForm((current) => ({ ...current, observation_date: event.target.value }))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="observation-comment">Commentaar</label>
              <textarea
                id="observation-comment"
                rows={5}
                value={form.comment}
                onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))}
                placeholder="Noteer hier je observatie..."
              />
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" type="button" onClick={closeObservationModal} disabled={saving}>
                Annuleren
              </button>
              <button className="btn btn-primary" type="button" onClick={handleSaveObservation} disabled={saving || !form.status || !form.observation_date}>
                {saving ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
          </section>
        </div>
      )}

      {infoGoal && (
        <div className="modal-backdrop">
          <section className="modal-card goal-detail-modal" role="dialog" aria-modal="true" aria-labelledby="goal-detail-title">
            <div className="modal-header">
              <div>
                <h2 id="goal-detail-title">{infoGoal.goal?.code ?? 'Geen doelcode'}</h2>
                <p className="text-muted">Details van het gekoppelde observatiedoel.</p>
              </div>
              <button className="icon-button" type="button" onClick={closeGoalInfo} aria-label="Sluiten">
                ✕
              </button>
            </div>

            <div className="goal-detail-content">
              <h3>{infoGoal.goal?.title ?? infoGoal.name}</h3>
              <span className="goal-metadata">
                {[infoGoal.subject, infoGoal.domain, infoGoal.subdomain, infoGoal.goal?.cluster]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <p>{infoGoal.goal?.description ?? 'Er is geen extra omschrijving beschikbaar voor dit doel.'}</p>
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary" type="button" onClick={closeGoalInfo}>
                Sluiten
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
