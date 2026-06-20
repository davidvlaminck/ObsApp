import { AxiosError } from 'axios'
import { FormEvent, useEffect, useState } from 'react'
import {
  createSchool,
  createSchoolYear,
  activateSchoolYear,
  getMe,
  getSchoolYears,
  getSchools,
  SchoolResponse,
  SchoolYearResponse,
  UserResponse,
} from '../services/auth'

const formatDate = (value: string) => {
  if (!value) return value
  const [year, month, day] = value.split('-')
  return `${day}-${month}-${year}`
}

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

export default function SchoolsPage() {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [schools, setSchools] = useState<SchoolResponse[]>([])
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null)
  const [schoolYears, setSchoolYears] = useState<SchoolYearResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [schoolForm, setSchoolForm] = useState({ name: '', slug: '', is_active: true })
  const [schoolSaving, setSchoolSaving] = useState(false)
  const [schoolOpen, setSchoolOpen] = useState(false)

  const [yearForm, setYearForm] = useState({ name: '', start_date: '', end_date: '', is_active: false })
  const [yearSaving, setYearSaving] = useState(false)
  const [yearOpen, setYearOpen] = useState(false)
  const [canManageYears, setCanManageYears] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const me = await getMe()
        setUser(me)
        const schoolsData = await getSchools()
        setSchools(schoolsData)
        if (me.school_id) {
          setSelectedSchoolId(me.school_id)
        }
        setCanManageYears(me.is_superuser || Boolean(me.school_id))
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
    if (!selectedSchoolId) {
      setSchoolYears([])
      return
    }
    const loadYears = async () => {
      try {
        const years = await getSchoolYears(selectedSchoolId)
        setSchoolYears(years)
        setError('')
      } catch (err) {
        setError(getErrorMessage(err, 'Kan schooljaren niet laden.'))
      }
    }
    loadYears()
  }, [selectedSchoolId])

  const handleCreateSchool = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSchoolSaving(true)
    setError('')
    setSuccess('')
    try {
      const created = await createSchool({
        name: schoolForm.name,
        slug: schoolForm.slug || undefined,
        is_active: schoolForm.is_active,
      })
      setSuccess(`School ${created.name} is aangemaakt.`)
      setSchoolForm({ name: '', slug: '', is_active: true })
      setSchoolOpen(false)
      const schoolsData = await getSchools()
      setSchools(schoolsData)
      setSelectedSchoolId(created.id)
    } catch (err) {
      setError(getErrorMessage(err, 'Kan school niet aanmaken.'))
    } finally {
      setSchoolSaving(false)
    }
  }

  const handleCreateSchoolYear = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedSchoolId) return
    setYearSaving(true)
    setError('')
    setSuccess('')
    try {
      const created = await createSchoolYear(selectedSchoolId, {
        name: yearForm.name,
        start_date: yearForm.start_date,
        end_date: yearForm.end_date,
        is_active: yearForm.is_active,
      })
      setSuccess(`Schooljaar ${created.name} is aangemaakt.`)
      setYearForm({ name: '', start_date: '', end_date: '', is_active: false })
      setYearOpen(false)
      const years = await getSchoolYears(selectedSchoolId)
      setSchoolYears(years)
    } catch (err) {
      setError(getErrorMessage(err, 'Kan schooljaar niet aanmaken.'))
    } finally {
      setYearSaving(false)
    }
  }

  const handleActivateSchoolYear = async (schoolYearId: number) => {
    setError('')
    setSuccess('')
    try {
      const updated = await activateSchoolYear(schoolYearId)
      setSuccess(`Schooljaar ${updated.name} is nu actief.`)
      if (selectedSchoolId) {
        const years = await getSchoolYears(selectedSchoolId)
        setSchoolYears(years)
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Kan schooljaar niet activeren.'))
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

  const isSuperuser = user?.is_superuser ?? false

  return (
    <div>
      <section className="page-header">
        <div>
          <h1>Schoolbeheer</h1>
          <p className="text-muted">Beheer scholen en schooljaren.</p>
        </div>
      </section>

      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      <section className="management-grid">
        <div className="table-card">
          <div className="table-header">
            <div>
              <h2>Scholen</h2>
              <p className="text-muted">Alleen zichtbaar voor superusers.</p>
            </div>
            {isSuperuser && (
              <div className="table-actions">
                <button className="btn btn-primary" type="button" onClick={() => setSchoolOpen((open) => !open)}>
                  {schoolOpen ? 'Formulier sluiten' : 'School aanmaken'}
                </button>
              </div>
            )}
          </div>

          {schoolOpen && isSuperuser && (
            <div className="card form-card">
              <h2>Nieuwe school</h2>
              <form onSubmit={handleCreateSchool}>
                <div className="form-group">
                  <label htmlFor="school-name">Naam</label>
                  <input
                    id="school-name"
                    type="text"
                    value={schoolForm.name}
                    onChange={(event) => setSchoolForm((current) => ({ ...current, name: event.target.value }))}
                    required
                    disabled={schoolSaving}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="school-slug">Slug (optioneel)</label>
                  <input
                    id="school-slug"
                    type="text"
                    value={schoolForm.slug}
                    onChange={(event) => setSchoolForm((current) => ({ ...current, slug: event.target.value }))}
                    disabled={schoolSaving}
                  />
                </div>
                <div className="checkbox-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={schoolForm.is_active}
                      onChange={(event) => setSchoolForm((current) => ({ ...current, is_active: event.target.checked }))}
                      disabled={schoolSaving}
                    />
                    Actief
                  </label>
                </div>
                <button className="btn btn-primary" type="submit" disabled={schoolSaving}>
                  {schoolSaving ? 'Opslaan...' : 'School aanmaken'}
                </button>
              </form>
            </div>
          )}

          {schools.length === 0 ? (
            <div className="empty-state">
              <h2>Geen scholen gevonden</h2>
              <p className="text-muted">Maak hierboven een nieuwe school aan.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Naam</th>
                    <th>Slug</th>
                    <th>Status</th>
                    <th>Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {schools.map((school) => (
                    <tr key={school.id} className={selectedSchoolId === school.id ? 'row-selected' : ''}>
                      <td>
                        <strong>{school.name}</strong>
                      </td>
                      <td>{school.slug}</td>
                      <td>
                        <span className={school.is_active ? 'badge badge-active' : 'badge'}>
                          {school.is_active ? 'Actief' : 'Inactief'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="table-action"
                          type="button"
                          onClick={() => setSelectedSchoolId(school.id)}
                        >
                          {selectedSchoolId === school.id ? 'Geselecteerd' : 'Selecteren'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="table-card">
          <div className="table-header">
            <div>
              <h2>Schooljaren</h2>
              <p className="text-muted">
                {selectedSchoolId ? `Voor geselecteerde school (${selectedSchoolId})` : 'Selecteer eerst een school.'}
              </p>
            </div>
            <div className="table-actions">
              {canManageYears && selectedSchoolId && (
                <button className="btn btn-primary" type="button" onClick={() => setYearOpen((open) => !open)}>
                  {yearOpen ? 'Formulier sluiten' : 'Schooljaar aanmaken'}
                </button>
              )}
            </div>
          </div>

          {yearOpen && canManageYears && selectedSchoolId && (
            <div className="card form-card">
              <h2>Nieuw schooljaar</h2>
              <form onSubmit={handleCreateSchoolYear}>
                <div className="form-group">
                  <label htmlFor="year-name">Naam</label>
                  <input
                    id="year-name"
                    type="text"
                    value={yearForm.name}
                    onChange={(event) => setYearForm((current) => ({ ...current, name: event.target.value }))}
                    required
                    disabled={yearSaving}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="year-start">Startdatum</label>
                  <input
                    id="year-start"
                    type="date"
                    value={yearForm.start_date}
                    onChange={(event) => setYearForm((current) => ({ ...current, start_date: event.target.value }))}
                    required
                    disabled={yearSaving}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="year-end">Einddatum</label>
                  <input
                    id="year-end"
                    type="date"
                    value={yearForm.end_date}
                    onChange={(event) => setYearForm((current) => ({ ...current, end_date: event.target.value }))}
                    required
                    disabled={yearSaving}
                  />
                </div>
                <div className="checkbox-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={yearForm.is_active}
                      onChange={(event) => setYearForm((current) => ({ ...current, is_active: event.target.checked }))}
                      disabled={yearSaving}
                    />
                    Actief
                  </label>
                </div>
                <button className="btn btn-primary" type="submit" disabled={yearSaving}>
                  {yearSaving ? 'Opslaan...' : 'Schooljaar aanmaken'}
                </button>
              </form>
            </div>
          )}

          {!selectedSchoolId ? (
            <div className="empty-state">
              <h2>Geen school geselecteerd</h2>
              <p className="text-muted">Selecteer een school om de schooljaren te bekijken.</p>
            </div>
          ) : schoolYears.length === 0 ? (
            <div className="empty-state">
              <h2>Geen schooljaren gevonden</h2>
              <p className="text-muted">Maak hierboven een nieuw schooljaar aan.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Naam</th>
                    <th>Periode</th>
                    <th>Status</th>
                    <th>Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {schoolYears.map((year) => (
                    <tr key={year.id} className={selectedSchoolId === year.id ? 'row-selected' : ''}>
                      <td>
                        <strong>{year.name}</strong>
                      </td>
                      <td>
                        {formatDate(year.start_date)} – {formatDate(year.end_date)}
                      </td>
                      <td>
                        <span className={year.is_active ? 'badge badge-active' : 'badge'}>
                          {year.is_active ? 'Actief' : 'Inactief'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="table-action"
                          type="button"
                          onClick={() => handleActivateSchoolYear(year.id)}
                        >
                          {year.is_active ? 'Actief' : 'Activeren'}
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
  )
}
