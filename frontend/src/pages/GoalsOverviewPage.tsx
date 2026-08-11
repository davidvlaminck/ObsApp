import { AxiosError } from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { sortClasses, sortSubjects, getSubjectPriority } from '../lib/subjectSort'
import {
  getClasses,
  getMe,
  getSchoolYears,
  type ClassResponse,
  type UserResponse,
} from '../services/auth'
import {
  getClassGoalsOverview,
  type ClassGoalStatusResponse,
} from '../services/observations'

const PAGE_SIZE = 25

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

const getGoalSubject = (goal: ClassGoalStatusResponse): string => goal.subject

const getGoalTitle = (goal: ClassGoalStatusResponse): string => goal.title

const getGoalCode = (goal: ClassGoalStatusResponse): string => goal.code ?? ''

const sortGoals = (goals: ClassGoalStatusResponse[]): ClassGoalStatusResponse[] => {
  return [...goals].sort((a, b) => {
    const subjectA = getGoalSubject(a)
    const subjectB = getGoalSubject(b)

    const priorityA = getSubjectPriority(subjectA)
    const priorityB = getSubjectPriority(subjectB)

    if (priorityA !== priorityB) {
      if (priorityA === -1 && priorityB === -1) return subjectA.localeCompare(subjectB)
      if (priorityA === -1) return 1
      if (priorityB === -1) return -1
      return priorityA - priorityB
    }

    const domainCompare = (a.domain ?? '').localeCompare(b.domain ?? '')
    if (domainCompare !== 0) return domainCompare

    return getGoalTitle(a).localeCompare(getGoalTitle(b))
  })
}

export default function GoalsOverviewPage() {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<ClassResponse[]>([])
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null)
  const [error, setError] = useState('')

  const [allGoals, setAllGoals] = useState<ClassGoalStatusResponse[]>([])
  const [loadingGoals, setLoadingGoals] = useState(false)

  const [filterSubject, setFilterSubject] = useState('')
  const [filterDomain, setFilterDomain] = useState('')
  const [filterSubdomain, setFilterSubdomain] = useState('')
  const [filterQ, setFilterQ] = useState('')

  const [pageToAchieve, setPageToAchieve] = useState(1)
  const [pageAchieved, setPageAchieved] = useState(1)

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

          if (currentUser.default_class_id) {
            setSelectedClassId(currentUser.default_class_id)
          } else if (loadedClasses.length === 1) {
            setSelectedClassId(loadedClasses[0].id)
          }
        }
      } catch (err) {
        setError(getErrorMessage(err, 'Kan startgegevens niet laden.'))
      } finally {
        setLoading(false)
      }
    }

    loadUserAndClasses()
  }, [])

  useEffect(() => {
    if (!selectedClassId) {
      setAllGoals([])
      return
    }

    const loadGoals = async () => {
      try {
        setError('')
        setLoadingGoals(true)
        const data = await getClassGoalsOverview({ class_id: selectedClassId })
        setAllGoals(sortGoals(data.goals))
      } catch (err) {
        setError(getErrorMessage(err, 'Kan doelen niet laden.'))
        setAllGoals([])
      } finally {
        setLoadingGoals(false)
      }
    }

    loadGoals()
  }, [selectedClassId])

  useEffect(() => {
    setPageToAchieve(1)
    setPageAchieved(1)
  }, [filterSubject, filterDomain, filterSubdomain, filterQ, selectedClassId])

  const { subjects, domains, subdomains } = useMemo(() => {
    const subjects = sortSubjects([...new Set(allGoals.map((g) => getGoalSubject(g)))])

    let domainSet: string[] = []
    let subdomainSet: string[] = []

    if (filterSubject) {
      const filtered = allGoals.filter((g) => getGoalSubject(g) === filterSubject)
      domainSet = sortSubjects([
        ...new Set(filtered.map((g) => g.domain).filter(Boolean) as string[]),
      ])

      if (filterDomain) {
        const byDomain = filtered.filter((g) => g.domain === filterDomain)
        subdomainSet = sortSubjects([
          ...new Set(byDomain.map((g) => g.subdomain).filter(Boolean) as string[]),
        ])
      }
    }

    return { subjects, domains: domainSet, subdomains: subdomainSet }
  }, [allGoals, filterSubject, filterDomain])

  const filteredGoals = useMemo(() => {
    return allGoals.filter((goal) => {
      if (filterSubject && getGoalSubject(goal) !== filterSubject) return false
      if (filterDomain && (goal.domain ?? '') !== filterDomain) return false
      if (filterSubdomain && (goal.subdomain ?? '') !== filterSubdomain) return false
      if (filterQ.trim().length >= 2) {
        const searchTerm = filterQ.trim().toLowerCase()
        const inCode = getGoalCode(goal).toLowerCase().includes(searchTerm)
        const inTitle = getGoalTitle(goal).toLowerCase().includes(searchTerm)
        if (!inCode && !inTitle) return false
      }
      return true
    })
  }, [allGoals, filterSubject, filterDomain, filterSubdomain, filterQ])

  const { goalsToAchieve, goalsAchieved } = useMemo(() => {
    const toAchieve = filteredGoals.filter(
      (goal) => !goal.is_observed_in_class && !goal.is_in_activity,
    )
    const achieved = filteredGoals.filter(
      (goal) => goal.is_observed_in_class || goal.is_in_activity,
    )
    return {
      goalsToAchieve: sortGoals(toAchieve),
      goalsAchieved: sortGoals(achieved),
    }
  }, [filteredGoals])

  const totalToAchieve = goalsToAchieve.length
  const totalAchieved = goalsAchieved.length

  const paginatedToAchieve = goalsToAchieve.slice((pageToAchieve - 1) * PAGE_SIZE, pageToAchieve * PAGE_SIZE)
  const paginatedAchieved = goalsAchieved.slice((pageAchieved - 1) * PAGE_SIZE, pageAchieved * PAGE_SIZE)

  const totalPagesToAchieve = Math.ceil(totalToAchieve / PAGE_SIZE)
  const totalPagesAchieved = Math.ceil(totalAchieved / PAGE_SIZE)

  const renderPagination = (
    currentPage: number,
    totalPages: number,
    onPageChange: (page: number) => void,
  ) => {
    if (totalPages <= 1) return null

    const pages: (number | string)[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('…')

      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      for (let i = start; i <= end; i++) pages.push(i)

      if (currentPage < totalPages - 2) pages.push('…')
      pages.push(totalPages)
    }

    return (
      <div className="pagination">
        <button
          className="pagination-button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          aria-label="Vorige pagina"
        >
          ←
        </button>
        {pages.map((page, idx) =>
          page === '…' ? (
            <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
              …
            </span>
          ) : (
            <button
              key={page as number}
              className={`pagination-button ${page === currentPage ? 'active' : ''}`}
              onClick={() => onPageChange(page as number)}
              aria-label={`Pagina ${page}`}
            >
              {page}
            </button>
          ),
        )}
        <button
          className="pagination-button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          aria-label="Volgende pagina"
        >
          →
        </button>
      </div>
    )
  }

  const clearFilters = () => {
    setFilterSubject('')
    setFilterDomain('')
    setFilterSubdomain('')
    setFilterQ('')
  }

  if (loading) {
    return <div className="empty-state compact">Gegevens laden...</div>
  }

  if (user?.is_superuser) {
    return (
      <>
        <section className="page-header">
          <div>
            <h1>Overzicht voor doelen</h1>
            <p className="text-muted">Overzicht van observatiedoelen per klas.</p>
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
          <h1>Overzicht voor doelen</h1>
          <p className="text-muted">Kies een klas om doelen te zien die nog moeten worden gewerkt en welke al gehaald zijn.</p>
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
        </div>

        {!selectedClassId ? (
          <div className="empty-state">Kies een klas om het overzicht voor doelen te bekijken.</div>
        ) : loadingGoals ? (
          <div className="empty-state compact">Gegevens laden...</div>
        ) : !!error ? (
          <div className="empty-state">Kan overzicht niet laden.</div>
        ) : (
          <>
            <div className="goals-overview-filters">
              <div className="form-group">
                <label htmlFor="goals-filter-subject">Vak</label>
                <select
                  id="goals-filter-subject"
                  value={filterSubject}
                  onChange={(e) => {
                    setFilterSubject(e.target.value)
                    setFilterDomain('')
                    setFilterSubdomain('')
                  }}
                >
                  <option value="">Alle vakken</option>
                  {subjects.map((subject: string) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="goals-filter-domain">Domein</label>
                <select
                  id="goals-filter-domain"
                  value={filterDomain}
                  disabled={!filterSubject}
                  onChange={(e) => {
                    setFilterDomain(e.target.value)
                    setFilterSubdomain('')
                  }}
                >
                  <option value="">Alle domeinen</option>
                  {domains.map((domain: string) => (
                    <option key={domain} value={domain}>
                      {domain}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="goals-filter-subdomain">Subdomein</label>
                <select
                  id="goals-filter-subdomain"
                  value={filterSubdomain}
                  disabled={!filterDomain}
                  onChange={(e) => setFilterSubdomain(e.target.value)}
                >
                  <option value="">Alle subdomeinen</option>
                  {subdomains.map((subdomain: string) => (
                    <option key={subdomain} value={subdomain}>
                      {subdomain}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="goals-filter-q">Zoek in code/omschrijving</label>
                <input
                  id="goals-filter-q"
                  value={filterQ}
                  onChange={(e) => setFilterQ(e.target.value)}
                  placeholder="Typ minstens 2 tekens"
                />
              </div>

              {(filterSubject || filterDomain || filterSubdomain || filterQ) && (
                <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={clearFilters}
                  >
                    Filters wissen
                  </button>
                </div>
              )}
            </div>

            <div className="goals-overview-cards">
              <section className="table-card goals-overview-card">
                <div className="table-header">
                  <div>
                    <h2>Doelen te behalen</h2>
                    <p className="text-muted">Doelen die nog niet in een activiteit zijn opgenomen en nog niet zijn geobserveerd in deze klas ({classes.find((c) => c.id === selectedClassId)?.name}).</p>
                  </div>
                  <span className="count-pill">{totalToAchieve}</span>
                </div>

                {totalToAchieve === 0 ? (
                  <div className="empty-state compact">Alle doelen zijn al gehaald of in een activiteit.</div>
                ) : (
                  <>
                    <div className="table-wrapper">
                      <table className="data-table goals-overview-table">
                        <thead>
                          <tr>
                            <th>Code</th>
                            <th>Leerdoel</th>
                            <th>Vak</th>
                            <th>Domein</th>
                            <th>Subdomein</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedToAchieve.map((goal) => {
                            const code = getGoalCode(goal)
                            return (
                              <tr key={goal.id}>
                                <td className="goal-code-cell">{code || '—'}</td>
                                <td className="goal-title-cell">{getGoalTitle(goal)}</td>
                                <td>{getGoalSubject(goal)}</td>
                                <td>{goal.domain ?? '—'}</td>
                                <td>{goal.subdomain ?? '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    {renderPagination(pageToAchieve, totalPagesToAchieve, setPageToAchieve)}
                  </>
                )}
              </section>

              <section className="table-card goals-overview-card">
                <div className="table-header">
                  <div>
                    <h2>Doelen al gehaald</h2>
                    <p className="text-muted">Doelen die al gekoppeld zijn aan een activiteit of al gecontroleerd zijn in deze klas.</p>
                  </div>
                  <span className="count-pill">{totalAchieved}</span>
                </div>

                {totalAchieved === 0 ? (
                  <div className="empty-state compact">Geen doelen gehaald. Begin met observeren of koppel doelen aan activiteiten.</div>
                ) : (
                  <>
                    <div className="table-wrapper">
                      <table className="data-table goals-overview-table">
                        <thead>
                          <tr>
                            <th>Code</th>
                            <th>Leerdoel</th>
                            <th>Vak</th>
                            <th>Domein</th>
                            <th>Subdomein</th>
                            <th>Manier</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedAchieved.map((goal) => {
                            const reasons: string[] = []
                            if (goal.is_observed_in_class) reasons.push('Geobserveerd')
                            if (goal.is_in_activity) reasons.push('In activiteit')
                            const code = getGoalCode(goal)
                            return (
                              <tr key={goal.id}>
                                <td className="goal-code-cell">{code || '—'}</td>
                                <td className="goal-title-cell">{getGoalTitle(goal)}</td>
                                <td>{getGoalSubject(goal)}</td>
                                <td>{goal.domain ?? '—'}</td>
                                <td>{goal.subdomain ?? '—'}</td>
                                <td className="status-cell">{reasons.join(' + ')}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    {renderPagination(pageAchieved, totalPagesAchieved, setPageAchieved)}
                  </>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </>
  )
}
