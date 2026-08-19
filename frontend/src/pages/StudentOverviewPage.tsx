import { AxiosError } from 'axios'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SubjectChips } from '../components/SubjectChips'
import { getClasses, getMe, getSchoolYears, type ClassResponse, type StudentResponse, type UserResponse } from '../services/auth'
import { sortClasses, getSubjectPriority } from '../lib/subjectSort'
import {
  getOverview,
  getObservationGoalSubjects,
  getObservationGoalDomains,
  listStudentObservations,
  type ObservationStatus,
  type OverviewResponse,
  type StudentObservationResponse,
} from '../services/observations'
import {
  useColorTheme,
  darkenColor,
} from '../hooks/useTheme'

const statusLabels: Record<ObservationStatus, string> = {
  onvoldoende: 'Onvoldoende',
  in_ontwikkeling: 'In ontwikkeling',
  voldoende: 'Voldoende',
  voorsprong: 'Voorsprong',
  geen_observatie: 'Geen observatie',
}

const getStatusColor = (statusColors: Record<string, string>, status?: ObservationStatus) => {
  if (!status) return '#f5f5f5'
  return statusColors[status] ?? '#f5f5f5'
}

const getStudentChipStyle = (statusColors: Record<string, string>, status?: ObservationStatus) => {
  const color = getStatusColor(statusColors, status)
  return {
    backgroundColor: color,
    borderColor: darkenColor(color, 0.2),
  }
}

const formatDate = (value: string) => {
  const [year, month, day] = value.split('-')
  return `${day}-${month}-${year}`
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

export default function StudentOverviewPage() {
  const { statusColors } = useColorTheme()
  const [user, setUser] = useState<UserResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<ClassResponse[]>([])
  const [subjects, setSubjects] = useState<string[]>([])
  const [domains, setDomains] = useState<string[]>([])
  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null)
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedDomain, setSelectedDomain] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [studentObservations, setStudentObservations] = useState<StudentObservationResponse[]>([])
  const [studentObservationsLoading, setStudentObservationsLoading] = useState(false)
  const [popoverTarget, setPopoverTarget] = useState<StudentObservationResponse | null>(null)

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

            // Use default_class_id if set, otherwise use first class if only one
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

  const loadOverview = useCallback(async () => {
    if (!user || user.is_superuser || !user.school_id || !selectedClassId) {
      setOverview(null)
      return
    }

    try {
      setError('')
      const data = await getOverview(selectedClassId, selectedSubject || undefined, selectedDomain || undefined)
      setOverview(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Kan overzicht niet laden.'))
      setOverview(null)
    }
  }, [selectedClassId, selectedSubject, selectedDomain, user])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  useEffect(() => {
    if (!selectedClassId) {
      setSelectedStudentId(null)
      setStudentObservations([])
      return
    }

    setSelectedStudentId(null)

    const loadStudentObservations = async () => {
      try {
        setStudentObservationsLoading(true)
        const observations = await listStudentObservations()
        setStudentObservations(observations)
      } catch (err) {
        setError(getErrorMessage(err, 'Kan observaties niet laden.'))
      } finally {
        setStudentObservationsLoading(false)
      }
    }

    loadStudentObservations()
  }, [selectedClassId])

  useEffect(() => {
    const loadDomains = async () => {
      if (!selectedSubject) {
        setDomains([])
        setSelectedDomain('')
        return
      }

      try {
        const domainList = await getObservationGoalDomains(selectedSubject)
        setDomains(domainList)
        setSelectedDomain('')
      } catch (err) {
        setError(getErrorMessage(err, 'Kan domeinen niet laden.'))
      }
    }

    loadDomains()
  }, [selectedSubject])

  const selectedStudent = useMemo(() => {
    if (!overview || selectedStudentId === null) return null
    return overview.students.find((student) => student.id === selectedStudentId) ?? null
  }, [overview, selectedStudentId])

  const studentIndex = useMemo(() => {
    if (!overview || selectedStudentId === null) return -1
    return overview.students.findIndex((student) => student.id === selectedStudentId)
  }, [overview, selectedStudentId])

  const goToStudent = useCallback(
    (direction: 1 | -1) => {
      if (!overview || overview.students.length === 0) return
      const currentIndex = studentIndex === -1 ? 0 : studentIndex
      const nextIndex =
        (currentIndex + direction + overview.students.length) % overview.students.length
      setSelectedStudentId(overview.students[nextIndex].id)
    },
    [overview, studentIndex],
  )

  const selectedStudentObservations = useMemo(() => {
    if (selectedStudentId === null) return []

    return studentObservations
      .filter((observation) => observation.student_id === selectedStudentId)
      .filter((observation) => !selectedSubject || observation.observation_goal?.subject === selectedSubject)
      .filter((observation) => !selectedDomain || observation.observation_goal?.domain === selectedDomain)
      .sort((a, b) => {
        const dateComparison = b.observation_date.localeCompare(a.observation_date)
        if (dateComparison !== 0) return dateComparison

        return (b.created_at ?? '').localeCompare(a.created_at ?? '')
      })
  }, [selectedStudentId, selectedSubject, selectedDomain, studentObservations])

  useEffect(() => {
    if (!popoverTarget) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPopoverTarget(null)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [popoverTarget])

  const groupedObservations = useMemo(() => {
    if (selectedStudentId === null || selectedStudentObservations.length === 0) return []

    const groups = new Map<number, StudentObservationResponse[]>()

    for (const observation of selectedStudentObservations) {
      const goalId = observation.observation_goal_id
      const existing = groups.get(goalId)
      if (existing) {
        existing.push(observation)
      } else {
        groups.set(goalId, [observation])
      }
    }

    return Array.from(groups.entries())
      .map(([goalId, observations]) => ({
        goalId,
        goalName: observations[0].observation_goal?.name ?? 'Onbekend doel',
        goalSubject: observations[0].observation_goal?.subject ?? '',
        goalDomain: observations[0].observation_goal?.domain ?? '',
        latest: observations[0],
        history: [...observations].reverse(),
      }))
      .sort((a, b) => {
        const priorityA = getSubjectPriority(a.goalSubject)
        const priorityB = getSubjectPriority(b.goalSubject)

        if (priorityA !== priorityB) {
          if (priorityA === -1 && priorityB === -1) {
            return a.goalSubject.localeCompare(b.goalSubject)
          }
          if (priorityA === -1) return 1
          if (priorityB === -1) return -1
          return priorityA - priorityB
        }

        const domainCompare = a.goalDomain.localeCompare(b.goalDomain)
        if (domainCompare !== 0) return domainCompare

        return a.goalName.localeCompare(b.goalName)
      })
  }, [selectedStudentId, selectedStudentObservations])

  if (loading) {
    return <div className="empty-state compact">Gegevens laden...</div>
  }

  if (user?.is_superuser) {
    return (
      <>
        <section className="page-header">
          <div>
            <h1>Overzicht per kleuter</h1>
            <p className="text-muted">Overzicht van observaties per klas, vak en kleuter.</p>
          </div>
        </section>
        <div className="inline-message inline-message-error">
          Superusers moeten zich eerst als leerkracht identificeren voordat ze het overzicht kunnen bekijken.
        </div>
      </>
    )
  }

  return (
    <>
      <section className="page-header">
        <div>
          <h1>Overzicht per kleuter</h1>
          <p className="text-muted">Kies een klas, vak en kleuter om alle geobserveerde doelen te bekijken.</p>
        </div>
      </section>

      {error && <div className="inline-message inline-message-error">{error}</div>}

      <div className="overview-page-scroll">
        <div className="overview-filters">
          <div className="form-group">
            <label>Klas</label>
            <div className="class-chips">
              {classes.length === 0 ? (
                <span className="text-muted">Geen klassen beschikbaar</span>
              ) : (
                classes.map((classItem, index) => (
                  <button
                    key={classItem.id}
                    type="button"
                    className={`class-chip class-chip-${index % 4} ${
                      selectedClassId === classItem.id ? 'active' : ''
                    }`}
                    onClick={() => setSelectedClassId(classItem.id)}
                  >
                    {classItem.name}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Vak</label>
            <SubjectChips
              subjects={subjects}
              selectedSubject={selectedSubject}
              onSelect={setSelectedSubject}
              disabled={!selectedClassId}
            />
          </div>

          {selectedSubject && (
            <div className="form-group">
              <label>Domein</label>
              <div className="subject-chips">
                <button
                  type="button"
                  className={`subject-chip ${selectedDomain === '' ? 'active all' : ''}`}
                  disabled={!selectedClassId}
                  onClick={() => setSelectedDomain('')}
                >
                  Alle domeinen
                </button>
                {domains.map((domain, index) => (
                  <button
                    key={domain}
                    type="button"
                    className={`subject-chip chip-${index % 6} ${
                      selectedDomain === domain ? 'active' : ''
                    }`}
                    disabled={!selectedClassId}
                    onClick={() => setSelectedDomain(domain)}
                  >
                    {domain}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="student-overview-student">Leerling</label>
            <div className="student-nav">
              <select
                id="student-overview-student"
                value={selectedStudentId ?? ''}
                disabled={!selectedClassId || !overview?.students.length}
                onChange={(event) => {
                  const value = event.target.value ? Number(event.target.value) : null
                  setSelectedStudentId(value)
                }}
              >
                <option value="">Kies kleuter</option>
                {overview?.students.map((student: StudentResponse) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
              <div className="student-nav-buttons">
                <button
                  type="button"
                  className="btn btn-secondary student-nav-button"
                  aria-label="Vorige kleuter"
                  disabled={!selectedClassId || !overview?.students.length}
                  onClick={() => goToStudent(-1)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="btn btn-secondary student-nav-button"
                  aria-label="Volgende kleuter"
                  disabled={!selectedClassId || !overview?.students.length}
                  onClick={() => goToStudent(1)}
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        </div>

      {!selectedClassId ? (
        <div className="empty-state">Kies een klas om het overzicht per kleuter te bekijken.</div>
      ) : !overview || overview.students.length === 0 ? (
        <div className="empty-state">Geen kleuters gevonden voor deze klas.</div>
      ) : !selectedStudent ? (
        <div className="empty-state">Kies een kleuter om het overzicht per kleuter te bekijken.</div>
      ) : studentObservationsLoading ? (
        <div className="empty-state compact">Observaties laden...</div>
      ) : selectedStudentObservations.length === 0 ? (
        <div className="empty-state compact">Geen observaties gevonden voor deze selectie.</div>
      ) : (
        <section className="overview-student-panel">
          <div className="overview-student-panel-header">
            <div>
              <h2>{selectedStudent.name}</h2>
              <p className="text-muted">Alle geobserveerde doelen voor deze kleuter.</p>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table student-observation-table">
              <thead>
                <tr>
                  <th>Leerdoel</th>
                  <th>Status</th>
                  <th>Datum</th>
                  <th>Commentaar</th>
                  <th>Evolutie</th>
                </tr>
              </thead>
              <tbody>
                {groupedObservations.map(({ goalId, goalName, latest, history }) => (
                  <tr key={goalId}>
                    <td>
                      <div className="student-observation-goal-name">{goalName}</div>
                    </td>
                    <td className="observation-status-cell">
                      <span
                        className="overview-status-chip observation-status-square"
                        style={getStudentChipStyle(statusColors, latest.status)}
                        title={statusLabels[latest.status]}
                        onClick={() => setPopoverTarget(latest)}
                      />
                    </td>
                    <td>{formatDate(latest.observation_date)}</td>
                    <td>{latest.comment ?? '—'}</td>
                    <td className="observation-evolution-cell">
                      <div className="observation-evolution-row">
                        {history.map((obs) => (
                          <span
                            key={obs.id}
                            className="observation-evolution-chip"
                            style={getStudentChipStyle(statusColors, obs.status)}
                            title={statusLabels[obs.status]}
                            onClick={() => setPopoverTarget(obs)}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      </div>

      {popoverTarget && (
        <div
          className="observation-popup-overlay"
          onClick={() => setPopoverTarget(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="observation-popup" onClick={(e) => e.stopPropagation()}>
            <div className="observation-popup-header">
              <strong>{statusLabels[popoverTarget.status]}</strong>
              <button
                className="observation-popup-close"
                onClick={() => setPopoverTarget(null)}
                aria-label="Sluiten"
                type="button"
              >
                ×
              </button>
            </div>
            <p>
              <strong>Datum:</strong> {formatDate(popoverTarget.observation_date)}
            </p>
            {popoverTarget.comment && (
              <p>
                <strong>Commentaar:</strong> {popoverTarget.comment}
              </p>
            )}
            {popoverTarget.observer?.name && (
              <p>
                <strong>Leerkracht:</strong> {popoverTarget.observer.name}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
