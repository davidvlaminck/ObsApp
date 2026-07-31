import { AxiosError } from 'axios'
import DeleteIcon from '@mui/icons-material/Delete'
import { useEffect, useState } from 'react'
import {
  deleteActivity,
  getActivities,
  getThemes,
  ActivityResponse,
  ThemeResponse,
} from '../services/auth'

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

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivityResponse[]>([])
  const [themes, setThemes] = useState<ThemeResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filterThemeId, setFilterThemeId] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [activitiesData, themesData] = await Promise.all([
          getActivities(filterThemeId ? { theme_id: filterThemeId } : undefined),
          getThemes(),
        ])
        setActivities(activitiesData)
        setThemes(themesData)
        setError('')
      } catch (err) {
        setError(getErrorMessage(err, 'Kan activiteiten niet laden.'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [filterThemeId])

  const handleDelete = async (activityId: number, activityName: string) => {
    if (!window.confirm(`Activiteit "${activityName}" verwijderen?`)) return
    setError('')
    setSuccess('')
    try {
      await deleteActivity(activityId)
      setSuccess(`Activiteit ${activityName} is verwijderd.`)
      setActivities((current) => current.filter((a) => a.id !== activityId))
    } catch (err) {
      setError(getErrorMessage(err, 'Kan activiteit niet verwijderen.'))
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
          <h1>Activiteiten</h1>
          <p className="text-muted">Overzicht van alle activiteiten per thema.</p>
        </div>
      </section>

      {error && <div className="inline-message inline-message-error">{error}</div>}
      {success && <div className="inline-message inline-message-success">{success}</div>}

      <div className="management-grid">
        <div className="table-card">
          <div className="table-header">
            <div>
              <h2>Activiteiten</h2>
              <p className="text-muted">{activities.length === 0 ? 'Nog geen activiteiten.' : ''}</p>
            </div>
            <div className="table-actions">
              <label className="form-inline" style={{ marginRight: 8 }}>
                <span className="sr-only">Filter op thema</span>
                <select
                  className="table-filter-select"
                  value={filterThemeId ?? ''}
                  onChange={(e) => setFilterThemeId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Alle thema's</option>
                  {themes.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {activities.length === 0 ? (
            <div className="empty-state">
              <h2>Geen activiteiten gevonden</h2>
              <p className="text-muted">Maak in het themabeheer een nieuwe activiteit aan.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Naam</th>
                    <th>Omschrijving</th>
                    <th>Thema</th>
                    <th>Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((activity) => (
                    <tr key={activity.id}>
                      <td>
                        <strong>{activity.name}</strong>
                      </td>
                      <td>{activity.description || '-'}</td>
                      <td>{activity.theme?.name || '-'}</td>
                      <td>
                        <button
                          className="table-action danger-link delete-icon-button"
                          type="button"
                          onClick={() => handleDelete(activity.id, activity.name)}
                          aria-label="Verwijderen"
                          title="Verwijderen"
                        >
                          <DeleteIcon fontSize="small" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
