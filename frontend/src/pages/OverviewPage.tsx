import { AxiosError } from 'axios'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SubjectChips } from '../components/SubjectChips'
import {
  getClasses,
  getMe,
  getSchoolYears,
  type ClassResponse,
  type UserResponse,
} from '../services/auth'
import { sortClasses } from '../lib/subjectSort'
import {
  getOverview,
  getObservationGoalSubjects,
  listStudentObservations,
  type OverviewResponse,
  type ObservationStatus,
  type StudentObservationResponse,
} from '../services/observations'

const statusColors: Record<ObservationStatus, string> = {
  onvoldoende: '#ef5350',
  in_ontwikkeling: '#ff9800',
  voldoende: '#66bb6a',
  voorsprong: '#42a5f5',
  geen_observatie: '#9ca3af',
}

const getStatusColor = (status?: ObservationStatus) => {
  if (!status) return '#f5f5f5'
  return statusColors[status] ?? '#f5f5f5'
}

const isObservationNewer = (a: StudentObservationResponse, b: StudentObservationResponse) => {
  const dateComparison = a.observation_date.localeCompare(b.observation_date)
  if (dateComparison !== 0) return dateComparison > 0

  const createdComparison = (a.created_at ?? '').localeCompare(b.created_at ?? '')
  if (createdComparison !== 0) return createdComparison > 0

  return a.id > b.id
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

export default function OverviewPage() {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<ClassResponse[]>([])
  const [subjects, setSubjects] = useState<string[]>([])
  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null)
  const [selectedSubject, setSelectedSubject] = useState('')
  const [error, setError] = useState('')
  const [commentTarget, setCommentTarget] = useState<{ goalId: number; studentId: number } | null>(
    null
  )
  const [studentObservations, setStudentObservations] = useState<StudentObservationResponse[]>([])

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
        const activeSchoolYear =
          schoolYears.find((schoolYear) => schoolYear.is_active) ?? schoolYears[0] ?? null

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
      const data = await getOverview(selectedClassId, selectedSubject || undefined)
      setOverview(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Kan overzicht niet laden.'))
      setOverview(null)
    }
  }, [selectedClassId, selectedSubject, user])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  useEffect(() => {
    if (!selectedClassId) {
      setStudentObservations([])
      return
    }

    const loadStudentObservations = async () => {
      try {
        const observations = await listStudentObservations()
        setStudentObservations(observations)
      } catch (err) {
        setError(getErrorMessage(err, 'Kan observaties niet laden.'))
      }
    }

    loadStudentObservations()
  }, [selectedClassId])

  const statusByGoalAndStudent = useMemo(() => {
    const map = new Map<string, StudentObservationResponse>()

    for (const observation of studentObservations) {
      const key = `${observation.observation_goal_id}-${observation.student_id}`
      const current = map.get(key)

      if (!current || isObservationNewer(observation, current)) {
        map.set(key, observation)
      }
    }

    return map
  }, [studentObservations])

  if (loading) {
    return <div className="empty-state compact">Gegevens laden...</div>
  }

  if (user?.is_superuser) {
    return (
      <>
        <section className="page-header">
          <div>
            <h1>Overzicht per klas</h1>
            <p className="text-muted">Overzicht van observaties per klas en doel.</p>
          </div>
        </section>

        <div className="inline-message inline-message-error">
          Superusers moeten zich eerst als leerkracht identificeren voordat ze het overzicht kunnen
          bekijken.
        </div>
      </>
    )
  }

  return (
    <>
      <section className="page-header">
        <div>
          <h1>Overzicht per klas</h1>
          <p className="text-muted">
            Kies een klas en vak om de observatiestatus per kleuter te bekijken.
          </p>
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
        </div>

        {!selectedClassId ? (
          <div className="empty-state">Kies een klas om het overzicht te bekijken.</div>
        ) : !overview || overview.goals.length === 0 ? (
          <div className="empty-state">Geen observatiedoelen gevonden voor deze selectie.</div>
        ) : (
          <div className="overview-table-wrapper">
            <table className="overview-table">
              <thead>
                <tr>
                  <th className="overview-header-goal">Leerdoel</th>
                  {overview.students.map((student) => (
                    <th key={student.id} className="overview-header-student">
                      <span className="overview-student-name">{student.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {overview.goals.map((goal) => (
                  <tr key={goal.id}>
                    <td className="overview-cell-goal">
                      <div className="overview-goal-name">{goal.name}</div>
                    </td>

                    {overview.students.map((student) => {
                      const status = statusByGoalAndStudent.get(`${goal.id}-${student.id}`)
                      const hasComment = Boolean(status?.comment)
                      const isCommentOpen =
                        commentTarget?.goalId === goal.id && commentTarget?.studentId === student.id

                      return (
                        <td key={student.id} className="overview-cell-status">
                          <span
                            className={`overview-status-chip ${hasComment ? 'has-comment' : ''}`}
                            style={{ backgroundColor: getStatusColor(status?.status) }}
                            onClick={() => {
                              if (hasComment) {
                                setCommentTarget(
                                  isCommentOpen ? null : { goalId: goal.id, studentId: student.id }
                                )
                              }
                            }}
                          >
                            {hasComment && (
                              <span
                                className="overview-flag"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <svg
                                  width="10"
                                  height="12"
                                  viewBox="0 0 10 12"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    d="M1 1H9V10H1V1Z"
                                    fill="white"
                                    stroke="#424242"
                                    strokeWidth="1.2"
                                    strokeLinejoin="round"
                                  />
                                  <path d="M1 1V4L5 6.5L1 9V1Z" fill="#e53935" />
                                </svg>
                              </span>
                            )}
                          </span>

                          {isCommentOpen && status?.comment && (
                            <div className="overview-comment-popup">
                              <div className="overview-comment-header">
                                <strong>Commentaar</strong>
                                <button
                                  type="button"
                                  className="overview-comment-close"
                                  onClick={() => setCommentTarget(null)}
                                  aria-label="Sluiten"
                                >
                                  ×
                                </button>
                              </div>
                              <p>{status.comment}</p>
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}