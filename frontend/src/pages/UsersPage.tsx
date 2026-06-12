import { AxiosError } from 'axios'
import { FormEvent, useEffect, useState } from 'react'
import {
  createUser,
  getSchools,
  getUsers,
  SchoolResponse,
  UserCreate,
  UserResponse,
} from '../services/auth'

const emptyForm: UserCreate = {
  email: '',
  name: '',
  is_active: true,
  is_superuser: false,
  school_id: null,
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
    return 'Geen toegang. Alleen superusers kunnen gebruikers en scholen bekijken.'
  }

  return detail ?? fallback
}

export default function UsersPage() {
  const [form, setForm] = useState<UserCreate>(emptyForm)
  const [schools, setSchools] = useState<SchoolResponse[]>([])
  const [users, setUsers] = useState<UserResponse[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)

  useEffect(() => {
    const loadUsersPage = async () => {
      try {
        setLoading(true)
        const [schoolsData, usersData] = await Promise.all([getSchools(), getUsers()])
        setSchools(schoolsData)
        setUsers(usersData)
        setError('')
      } catch (error) {
        setError(getErrorMessage(error, 'Kan gebruikers en scholen niet laden. Controleer je verbinding.'))
      } finally {
        setLoading(false)
      }
    }

    loadUsersPage()
  }, [])

  const updateField = (field: keyof UserCreate, value: string | boolean | number | null) => {
    setForm((current) => ({ ...current, [field]: value }))
    setError('')
    setSuccess('')
  }

  const getSchoolName = (schoolId: number | null) => {
    if (schoolId === null) return 'Geen school'
    return schools.find((school) => school.id === schoolId)?.name ?? `School ${schoolId}`
  }

  const getUserStatus = (user: UserResponse) => {
    if (user.is_pending) return 'Uitnodiging verzonden'
    return user.is_active ? 'Actief' : 'Inactief'
  }

  const getUserStatusClass = (user: UserResponse) => {
    if (user.is_pending) return 'badge badge-pending'
    return user.is_active ? 'badge badge-active' : 'badge'
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const createdUser = await createUser(form)
      const message = createdUser.is_pending
        ? `Uitnodiging verzonden naar ${createdUser.email}.`
        : `Gebruiker ${createdUser.email} is aangemaakt.`
      setSuccess(message)
      setForm({ ...emptyForm })
      const usersData = await getUsers()
      setUsers(usersData)
    } catch (error) {
      setError(getErrorMessage(error, 'Kan gebruiker niet aanmaken.'))
    } finally {
      setSaving(false)
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

  return (
    <div>
      <section className="page-header">
        <div>
          <h1>Gebruikersbeheer</h1>
          <p className="text-muted">Nodig gebruikers uit en beheer rollen binnen ObsApp.</p>
        </div>
      </section>

      <section className={`management-grid ${inviteOpen ? 'invite-open' : ''}`}>
        {inviteOpen && (
        <div className="card form-card">
          <h2>Gebruiker uitnodigen</h2>
          <p className="text-muted">Laat het wachtwoord leeg om een activatiemail te sturen.</p>

          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="user-name">Naam</label>
              <input
                id="user-name"
                type="text"
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                required
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label htmlFor="user-email">E-mailadres</label>
              <input
                id="user-email"
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                required
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label htmlFor="user-school">School</label>
              <select
                id="user-school"
                value={form.school_id ?? ''}
                onChange={(event) => updateField('school_id', event.target.value ? Number(event.target.value) : null)}
                required
                disabled={saving || schools.length === 0}
              >
                <option value="">Kies een school</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="checkbox-row">
              <label>
                <input
                  type="checkbox"
                  checked={form.is_active ?? true}
                  onChange={(event) => updateField('is_active', event.target.checked)}
                  disabled={saving}
                />
                Actief
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={form.is_superuser ?? false}
                  onChange={(event) => updateField('is_superuser', event.target.checked)}
                  disabled={saving}
                />
                Superuser
              </label>
            </div>

            <button className="btn btn-primary" type="submit" disabled={saving || schools.length === 0}>
              {saving ? 'Verzenden...' : 'Uitnodiging versturen'}
            </button>
          </form>
        </div>
        )}

        <div className="table-card">
          <div className="table-header">
            <div>
              <h2>Gebruikers</h2>
              <p className="text-muted">Overzicht van alle gebruikers in de organisatie.</p>
            </div>
            <div className="table-actions">
              <span className="count-pill">{users.length} gebruikers</span>
              <button className="btn btn-primary" type="button" onClick={() => setInviteOpen((open) => !open)}>
                {inviteOpen ? 'Formulier sluiten' : 'Gebruiker uitnodigen'}
              </button>
            </div>
          </div>

          {users.length === 0 ? (
            <div className="empty-state">
              <h2>Geen gebruikers gevonden</h2>
              <p className="text-muted">Nodig hierboven een nieuwe gebruiker uit.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Naam</th>
                    <th>E-mail</th>
                    <th>School</th>
                    <th>Rol</th>
                    <th>Status</th>
                    <th>Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.name}</strong>
                      </td>
                      <td>{user.email}</td>
                      <td>{getSchoolName(user.school_id)}</td>
                      <td>
                        {user.is_superuser && <span className="badge badge-super">Superuser</span>}
                        {!user.is_superuser && <span className="badge">Leerkracht</span>}
                      </td>
                      <td>
                        <span className={getUserStatusClass(user)}>{getUserStatus(user)}</span>
                      </td>
                      <td>
                        <span className="table-action">—</span>
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
