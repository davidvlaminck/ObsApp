import { AxiosError } from 'axios'
import { FormEvent, useEffect, useState } from 'react'
import {
  createSchool,
  createSchoolYear,
  activateSchoolYear,
  getMe,
  getSchoolYears,
  getSchools,
  getPendingMembers,
  approvePendingMember,
  rejectPendingMember,
  SchoolResponse,
  SchoolYearResponse,
  UserResponse,
  PendingMemberResponse,
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
  const [schoolSearch, setSchoolSearch] = useState('')

  const [schoolForm, setSchoolForm] = useState({ name: '', slug: '', is_active: true })
  const [schoolSaving, setSchoolSaving] = useState(false)
  const [schoolOpen, setSchoolOpen] = useState(false)

  const [yearForm, setYearForm] = useState({ name: '', start_date: '', end_date: '', is_active: false })
  const [yearSaving, setYearSaving] = useState(false)
  const [yearOpen, setYearOpen] = useState(false)
  const [canManageYears, setCanManageYears] = useState(false)

  const [pendingMembers, setPendingMembers] = useState<PendingMemberResponse[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [pendingActionId, setPendingActionId] = useState<number | null>(null)

  const [showSearch, setShowSearch] = useState(false)

  const filteredSchools = schools.filter((school) => {
    if (!schoolSearch.trim()) return true
    const query = schoolSearch.toLowerCase()
    return school.name.toLowerCase().includes(query) || school.slug.toLowerCase().includes(query)
  })

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const me = await getMe()
        setUser(me)
        const schoolsData = await getSchools()
        setSchools(schoolsData)
        setShowSearch(me.is_superuser || schoolsData.length >= 5)
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

  useEffect(() => {
    if (!selectedSchoolId) {
      setPendingMembers([])
      return
    }
    const loadPending = async () => {
      setPendingLoading(true)
      try {
        const pending = await getPendingMembers(selectedSchoolId)
        setPendingMembers(pending)
      } catch {
        setPendingMembers([])
      } finally {
        setPendingLoading(false)
      }
    }
    loadPending()
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

  const handleApprove = async (userId: number) => {
    if (!selectedSchoolId) return
    setPendingActionId(userId)
    setError('')
    setSuccess('')
    try {
      await approvePendingMember(selectedSchoolId, userId)
      setSuccess('Lidmaatschap goedgekeurd.')
      setPendingMembers((prev) => prev.filter((m) => m.id !== userId))
    } catch (err) {
      setError(getErrorMessage(err, 'Kan verzoek niet goedkeuren.'))
    } finally {
      setPendingActionId(null)
    }
  }

  const handleReject = async (userId: number) => {
    if (!selectedSchoolId) return
    setPendingActionId(userId)
    setError('')
    setSuccess('')
    try {
      await rejectPendingMember(selectedSchoolId, userId)
      setSuccess('Verzoek afgewezen.')
      setPendingMembers((prev) => prev.filter((m) => m.id !== userId))
    } catch (err) {
      setError(getErrorMessage(err, 'Kan verzoek niet afwijzen.'))
    } finally {
      setPendingActionId(null)
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
              <p className="text-muted">
                {isSuperuser ? 'Beheer alle scholen.' : 'Je eigen school.'}
              </p>
            </div>
            {isSuperuser && (
              <div className="table-actions">
                <button className="btn btn-primary" type="button" onClick={() => setSchoolOpen((open) => !open)}>
                  {schoolOpen ? 'Formulier sluiten' : 'School aanmaken'}
                </button>
              </div>
            )}
          </div>

          {showSearch && (
            <div style={{ marginBottom: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="school-search">Zoeken</label>
                <input
                  id="school-search"
                  type="text"
                  value={schoolSearch}
                  onChange={(event) => setSchoolSearch(event.target.value)}
                  placeholder="Zoek op naam of slug..."
                />
              </div>
            </div>
          )}

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

          {filteredSchools.length === 0 ? (
            <div className="empty-state">
              <h2>Geen scholen gevonden</h2>
              <p className="text-muted">
                {schoolSearch ? 'Probeer een andere zoekterm.' : 'Je hebt nog geen school gekozen.'}
              </p>
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
                  {filteredSchools.map((school) => (
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

      {selectedSchoolId && (
        <section className="table-card" style={{ marginTop: '1.5rem' }}>
          <div className="table-header">
            <div>
              <h2>Toegangsverzoeken</h2>
              <p className="text-muted">
                {pendingLoading ? 'Laden...' : `${pendingMembers.length} verzoek${pendingMembers.length !== 1 ? 'en' : ''} in behandeling`}
              </p>
            </div>
          </div>

          {pendingMembers.length === 0 ? (
            <div className="empty-state">
              <h2>Geen openstaande verzoeken</h2>
              <p className="text-muted">Er zijn geen leerkrachten die wachten op toegang tot deze school.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Naam</th>
                    <th>E-mail</th>
                    <th>Koepel</th>
                    <th>Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingMembers.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <strong>{member.name}</strong>
                      </td>
                      <td>{member.email}</td>
                      <td>{member.pending_koepel || '-'}</td>
                      <td>
                        <button
                          className="btn btn-sm"
                          type="button"
                          onClick={() => handleApprove(member.id)}
                          disabled={pendingActionId === member.id}
                        >
                          {pendingActionId === member.id ? 'Bezig...' : 'Toelaten'}
                        </button>
                        <button
                          className="btn btn-sm"
                          type="button"
                          onClick={() => handleReject(member.id)}
                          disabled={pendingActionId === member.id}
                          style={{ marginLeft: '0.5rem' }}
                        >
                          Afwijzen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
