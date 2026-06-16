import { AxiosError } from 'axios'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
  getObservationGoalSubjects,
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

const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')

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

export default function ObservingPage() {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<ClassResponse[]>([])
  const [subjects, setSubjects] = useState<string[]>([])
  const [domains, setDomains] = useState<string[]>([])
  const [context, setContext] = useState<ObservationContextResponse>({
    goals: [],
    students: [],
    student_observations: {},
    class_info: null,
  })
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null)
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedDomain, setSelectedDomain] = useState('')
  const [selectedGoal, setSelectedGoal] = useState<ObservationGoalResponse | null>(null)
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null)
  const [selectedStudent, setSelectedStudent] = useState<StudentResponse | null>(null)
  const [goalInfoOpen, setGoalInfoOpen] = useState(false)
  const [observationModal, setObservationModal] = useState<ObservationModalState | null>(null)
  const [form, setForm] = useState<ObservationForm>({ status: '', observation_date: today, comment: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')

  const getStudentCardClassName = (status?: ObservationStatus) => {
    if (!status) {
      return 'student-card'
    }
    return `student-card status-${status}`
  }

  const getStudentObservation = (studentId: number): StudentObservationStatusResponse | undefined => context.student_observations[studentId]

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
          const loadedClasses = await getClasses(activeSchoolYear.id)
          setClasses(loadedClasses)
          if (loadedClasses.length === 1) {
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
    const loadDomains = async () => {
      if (!selectedSubject) {
        setDomains([])
        return
      }

      try {
        const domainsData = await getObservationGoalDomains(selectedSubject)
        setDomains(domainsData)
        if (selectedDomain && !domainsData.includes(selectedDomain)) {
          setSelectedDomain('')
        }
      } catch (err) {
        setError(getErrorMessage(err, 'Kan domeinen niet laden.'))
      }
    }

    loadDomains()
  }, [selectedSubject, selectedDomain])

  const loadContext = useCallback(async () => {
    if (!user || user.is_superuser || !user.school_id) {
      return
    }

    try {
      setError('')
      const data = await getObservationContext({
        class_id: selectedClassId || undefined,
        subject: selectedSubject || undefined,
        domain: selectedDomain || undefined,
        selected_goal_id: selectedGoalId,
      })
      setContext(data)

      if (selectedGoal && !data.goals.some((goal) => goal.id === selectedGoal.id)) {
        setSelectedGoal(null)
        setSelectedGoalId(null)
      }
      if (selectedStudent && !data.students.some((student) => student.id === selectedStudent.id)) {
        setSelectedStudent(null)
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Kan observatiecontext niet laden.'))
    }
  }, [selectedClassId, selectedDomain, selectedGoalId, selectedGoal, selectedStudent, selectedSubject, user])

  useEffect(() => {
    loadContext()
  }, [loadContext])

  const selectedGoalCode = useMemo(() => selectedGoal?.goal?.code ?? 'Geen Op Stap doel gekoppeld', [selectedGoal])

  const openObservationModal = (student: StudentResponse) => {
    if (!selectedGoal) {
      setError('Kies eerst een observatiedoel.')
      return
    }

    setObservationModal({ student, goal: selectedGoal })
    setForm({ status: '', observation_date: today, comment: '' })
    setFormError('')
  }

  const closeObservationModal = () => {
    setObservationModal(null)
    setFormError('')
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
      await loadContext()
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
          <p className="text-muted">Kies een klas, doel en leerling om een observatie vast te leggen.</p>
        </div>
      </section>

      {error && <div className="inline-message inline-message-error">{error}</div>}
      {success && <div className="inline-message inline-message-success">{success}</div>}

      <div className="observing-layout">
        <section className="observing-panel observing-filters">
          <h2>Filters</h2>

          <div className="form-group">
            <label htmlFor="observing-class">Klas</label>
            <select
              id="observing-class"
              value={selectedClassId ?? ''}
              onChange={(event) => {
                setSelectedClassId(event.target.value ? Number(event.target.value) : null)
                setSelectedGoal(null)
                setSelectedGoalId(null)
                setSelectedStudent(null)
              }}
            >
              <option value="">Kies klas</option>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="observing-subject">Vak</label>
            <select
              id="observing-subject"
              value={selectedSubject}
              onChange={(event) => {
                setSelectedSubject(event.target.value)
                setSelectedDomain('')
                setSelectedGoal(null)
                setSelectedGoalId(null)
              }}
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
            <label htmlFor="observing-domain">Domein</label>
            <select
              id="observing-domain"
              value={selectedDomain}
              disabled={!selectedSubject}
              onChange={(event) => {
                setSelectedDomain(event.target.value)
                setSelectedGoal(null)
                setSelectedGoalId(null)
              }}
            >
              <option value="">Alle domeinen</option>
              {domains.map((domain) => (
                <option key={domain} value={domain}>
                  {domain}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-outline btn-full"
            type="button"
            onClick={() => {
              setSelectedClassId(null)
              setSelectedSubject('')
              setSelectedDomain('')
              setSelectedGoal(null)
              setSelectedGoalId(null)
              setSelectedStudent(null)
              setSuccess('')
            }}
          >
            Filters wissen
          </button>
        </section>

        <section className="observing-panel">
          <div className="table-header">
            <div>
              <h2>Observatiedoelen</h2>
              <p className="text-muted">
                {selectedClassId ? 'Mogelijke doelen voor de gekozen klas.' : 'Kies een klas om doelen per klasniveau te zien.'}
              </p>
            </div>
            <span className="count-pill">{context.goals.length}</span>
          </div>

          {context.goals.length === 0 ? (
            <div className="empty-state compact">
              <h3>Geen doelen gevonden</h3>
              <p className="text-muted">Pas de filters aan of maak eerst observatiedoelen aan onder Beheer.</p>
            </div>
          ) : (
            <div className="goal-list">
             {context.goals.map((goal) => (
               <button
                 key={goal.id}
                 type="button"
                 className={`goal-selection-card ${selectedGoal?.id === goal.id ? 'selected' : ''}`}
                 onClick={() => {
                   setSelectedGoal(goal)
                   setSelectedGoalId(goal.id)
                   setSuccess('')
                 }}
               >
                  <span>
                    <strong>{goal.name}</strong>
                    <span className="goal-metadata">
                      {[goal.subject, goal.domain, goal.subdomain].filter(Boolean).join(' · ')}
                    </span>
                    <span className="goal-metadata">{goal.goal?.code ? `Doelcode: ${goal.goal.code}` : 'Geen Op Stap doel gekoppeld'}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="observing-panel">
          <div className="table-header">
            <div>
              <h2>Leerlingen</h2>
              <p className="text-muted">{selectedClassId ? 'Klik op een leerling om een observatie in te voeren.' : 'Kies eerst een klas.'}</p>
            </div>
            <span className="count-pill">{context.students.length}</span>
          </div>

          {context.students.length === 0 ? (
            <div className="empty-state compact">
              <h3>Geen leerlingen geladen</h3>
              <p className="text-muted">Kies een klas om de leerlingen van die klas te tonen.</p>
            </div>
          ) : (
            <div className="student-list">
              {context.students.map((student) => {
                const observation = getStudentObservation(student.id)
                return (
                  <button
                    key={student.id}
                    type="button"
                    className={getStudentCardClassName(observation?.status)}
                    onClick={() => openObservationModal(student)}
                  >
                    <span className="student-avatar">{getInitials(student.name)}</span>
                    <span>
                      <strong>{student.name}</strong>
                      <span className="text-muted">{getStudentObservationLabel(observation?.status)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {selectedGoal && (
        <section className="selected-observation-goal">
          <div>
            <span className="text-muted">Gekozen doel</span>
            <strong>{selectedGoal.name}</strong>
            <span className="goal-metadata">{[selectedGoal.subject, selectedGoal.domain, selectedGoal.subdomain].filter(Boolean).join(' · ')}</span>
          </div>
          <button className="btn btn-outline" type="button" onClick={() => setGoalInfoOpen(true)}>
            {selectedGoalCode}
          </button>
        </section>
      )}

      {goalInfoOpen && selectedGoal && (
        <div className="modal-backdrop">
          <section className="modal-card goal-detail-modal" role="dialog" aria-modal="true" aria-labelledby="goal-detail-title">
            <div className="modal-header">
              <div>
                <h2 id="goal-detail-title">{selectedGoalCode}</h2>
                <p className="text-muted">Details van het gekoppelde observatiedoel.</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setGoalInfoOpen(false)} aria-label="Sluiten">
                ✕
              </button>
            </div>

            <div className="goal-detail-content">
              <h3>{selectedGoal.goal?.title ?? selectedGoal.name}</h3>
              <span className="goal-metadata">
                {[selectedGoal.subject, selectedGoal.domain, selectedGoal.subdomain, selectedGoal.goal?.cluster]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <p>{selectedGoal.goal?.description ?? 'Er is geen extra omschrijving beschikbaar voor dit doel.'}</p>
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary" type="button" onClick={() => setGoalInfoOpen(false)}>
                Sluiten
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
    </>
  )
}
