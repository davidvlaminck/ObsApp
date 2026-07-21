import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMySchool, getSchoolYears, resetDemo } from '../services/auth'

export default function DemoSchoolPage() {
  const [school, setSchool] = useState<{ id: number; name: string; slug: string } | null>(null)
  const [schoolYear, setSchoolYear] = useState<{ id: number; name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      try {
        const s = await getMySchool()
        setSchool(s)
        if (s) {
          const years = await getSchoolYears(s.id)
          const active = years.find((y) => y.is_active) || years[0] || null
          setSchoolYear(active)
        }
      } catch {
        setError('Kon gegevens niet laden.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleReset = async () => {
    if (!window.confirm('Weet je zeker dat je alle demo data wilt resetten? Alle observaties en kleuteren worden verwijderd.')) {
      return
    }
    setResetting(true)
    setError('')
    try {
      await resetDemo()
      navigate('/select-koepel')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Reset mislukt. Probeer opnieuw.')
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="center-container">
        <div className="card">
          <p>Bezig met laden...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="center-container">
      <div className="card">
        <h1>Demo schoolbeheer</h1>
        {school && (
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f9fafb', borderRadius: '0.5rem' }}>
            <p><strong>School:</strong> {school.name}</p>
            {schoolYear && <p><strong>Schooljaar:</strong> {schoolYear.name}</p>}
          </div>
        )}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleReset}
          disabled={resetting}
        >
          {resetting ? 'Bezig...' : 'Reset demo data'}
        </button>
        <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.5rem' }}>
          Hiermee verwijder je alle demo data en kies je opnieuw een koepel.
        </p>
        {error && <p className="error" style={{ marginTop: '1rem' }}>{error}</p>}
      </div>
    </div>
  )
}
