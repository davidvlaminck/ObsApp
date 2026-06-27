import { AxiosError } from 'axios'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SubjectChips } from '../components/SubjectChips'
import { getClasses, getMe, getSchoolYears, type ClassResponse, type StudentResponse, type UserResponse } from '../services/auth'
import {
  getOverview,
  getObservationGoalSubjects,
  listStudentObservations,
  type ObservationStatus,
  type OverviewResponse,
  type StudentObservationResponse,
} from '../services/observations'

const statusColors: Record<ObservationStatus, string> = {
  onvoldoende: '#ef5350',
  in_ontwikkeling: '#ff9800',
  zelfstandig: '#66bb6a',
  voorsprong: '#42a5f5',
}

const statusLabels: Record<ObservationStatus, string> = {
  onvoldoende: 'Onvoldoende',
  in_ontwikkeling: 'In ontwikkeling',
  zelfstandig: 'Zelfstandig',
  voorsprong: 'Voorsprong',
}

const getStatusColor = (status?: ObservationStatus) => {
  if (!status) return '#f5f5f5'
  return statusColors[status] ?? '#f5f5f5'
}

const formatDate = (value: string) => {
  const [year, month, day] = value.split('-')
  return `${day}-${month}-${year}`
}

const getObservationGoalName = (observation: StudentObservationResponse) => {
  return observation.observation_goal?.name ?? 'Onbekend doel'
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
  const [user, setUser] = useState<UserResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<ClassResponse[]>([])
  const [subjects, setSubjects] = useState<string[]>([])
  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null)
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [studentObservations, setStudentObservations] = useState<StudentObservationResponse[]>([])
  const [studentObservationsLoading, setStudentObservationsLoading] = useState(false)

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

  const selectedStudent = useMemo(() => {
    if (!overview || selectedStudentId === null) return null
    return overview.students.find((student) => student.id === selectedStudentId) ?? null
  }, [overview, selectedStudentId])

  const selectedStudentObservations = useMemo(() => {
    if (selectedStudentId === null) return []

    return studentObservations
      .filter((observation) => observation.student_id === selectedStudentId)
      .filter((observation) => !selectedSubject || observation.observation_goal?.subject === selectedSubject)
      .sort((a, b) => {
        const dateComparison = b.observation_date.localeCompare(a.observation_date)
        if (dateComparison !== 0) return dateComparison

        return (b.created_at ?? '').localeCompare(a.created_at ?? '')
      })
  }, [selectedStudentId, selectedSubject, studentObservations])

  if (loading) {
    return <div className="empty-state compact">Gegevens laden...</div>
  }

  if (user?.is_superuser) {
    return (
      <>
        <section className="page-header">
          <div>
            <h1>Overzicht per leerling</h1>
            <p className="text-muted">Overzicht van observaties per klas, vak en leerling.</p>
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
          <h1>Overzicht per leerling</h1>
          <p className="text-muted">Kies een klas, vak en leerling om alle geobserveerde doelen te bekijken.</p>
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

          <div className="form-group">
            <label htmlFor="student-overview-student">Leerling</label>
            <select
              id="student-overview-student"
              value={selectedStudentId ?? ''}
              disabled={!selectedClassId || !overview?.students.length}
              onChange={(event) => {
                const value = event.target.value ? Number(event.target.value) : null
                setSelectedStudentId(value)
              }}
            >
              <option value="">Kies leerling</option>
              {overview?.students.map((student: StudentResponse) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </div>
        </div>

      {!selectedClassId ? (
        <div className="empty-state">Kies een klas om het overzicht per leerling te bekijken.</div>
      ) : !overview || overview.students.length === 0 ? (
        <div className="empty-state">Geen leerlingen gevonden voor deze klas.</div>
      ) : !selectedStudent ? (
        <div className="empty-state">Kies een leerling om het overzicht per leerling te bekijken.</div>
      ) : studentObservationsLoading ? (
        <div className="empty-state compact">Observaties laden...</div>
      ) : selectedStudentObservations.length === 0 ? (
        <div className="empty-state compact">Geen observaties gevonden voor deze selectie.</div>
      ) : (
        <section className="overview-student-panel">
          <div className="overview-student-panel-header">
            <div>
              <h2>{selectedStudent.name}</h2>
              <p className="text-muted">Alle geobserveerde doelen voor deze leerling.</p>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table student-observation-table">
              <thead>
                <tr>
                  <th>Leerdoel</th>
                  <th>Observatie</th>
                  <th>Datum</th>
                  <th>Leerkracht</th>
                  <th>Commentaar</th>
                </tr>
              </thead>
              <tbody>
                {selectedStudentObservations.map((observation) => (
                  <tr key={observation.id}>
                    <td>
                      <div className="student-observation-goal-name">{getObservationGoalName(observation)}</div>
                    </td>
                    <td>
                      <span
                        className="overview-observation-pill"
                        style={{ backgroundColor: getStatusColor(observation.status) }}
                      >
                        {statusLabels[observation.status]}
                      </span>
                    </td>
                    <td>{formatDate(observation.observation_date)}</td>
                    <td>{observation.observer?.name ?? '—'}</td>
                    <td>{observation.comment ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      </div>
    </>
  )
}
