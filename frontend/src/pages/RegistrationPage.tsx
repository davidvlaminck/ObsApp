import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getVlaanderenSchools, registerDemo, registerRegular } from '../services/auth'

export default function RegistrationPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [isDemo, setIsDemo] = useState(false)
  const [koepel, setKoepel] = useState('')
  const [schoolId, setSchoolId] = useState<number | ''>('')
  const [schoolName, setSchoolName] = useState('')
  const [showOtherSchool, setShowOtherSchool] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [schools, setSchools] = useState<Array<{id: string, name: string}>>([])
  const navigate = useNavigate()

  const loadSchools = async () => {
    try {
      const data = await getVlaanderenSchools()
      setSchools(data)
    } catch {
      // Schools will be empty, user can type their own
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isDemo) {
        await registerDemo({ email, name, koepel: koepel || null })
      } else {
        if (showOtherSchool && schoolName) {
          await registerRegular({ email, name, school_name: schoolName })
        } else if (schoolId) {
          await registerRegular({ email, name, school_id: Number(schoolId) })
        } else {
          setError('Selecteer een school of geef een andere school op')
          setLoading(false)
          return
        }
      }
      navigate('/login?registered=true')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registratie mislukt. Probeer opnieuw.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="center-container">
      <div className="card">
        <div className="avatar">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
        </div>
        <h1>Registreren</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Naam</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">E-mailadres</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="checkbox-row">
            <label
              style={{
                justifyContent: "center",
                gap: "6px",
                width: "100%",
              }}>
              <input
                type="checkbox"
                checked={isDemo}
                onChange={(e) => setIsDemo(e.target.checked)}
              />
              {' '}Demo account aanmaken
            </label>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Een demo account krijgt direct toegang tot testdata zonder schoolkeuze.
          </p>

          {!isDemo && (
            <>
              <div className="form-group">
                <label htmlFor="school">School</label>
                <select
                  id="school"
                  value={schoolId}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === 'other') {
                      setShowOtherSchool(true)
                      setSchoolId('')
                    } else {
                      setShowOtherSchool(false)
                      setSchoolId(value ? Number(value) : '')
                    }
                  }}
                  onFocus={loadSchools}
                >
                  <option value="">-- Kies een school --</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                  <option value="other">Andere school (niet in lijst)</option>
                </select>
              </div>

              {showOtherSchool && (
                <div className="form-group">
                  <label htmlFor="school_name">Naam van je school</label>
                  <input
                    id="school_name"
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="Bijv. Basisschool De Regenboog"
                  />
                </div>
              )}
            </>
          )}

          {isDemo && (
            <div className="form-group">
              <label htmlFor="koepel">Koepel (optioneel)</label>
              <select
                id="koepel"
                value={koepel}
                onChange={(e) => setKoepel(e.target.value)}
              >
                <option value="">-- Geen koepel --</option>
                <option value="KOOPPEL1">Koepel 1</option>
                <option value="KOOPPEL2">Koepel 2</option>
              </select>
            </div>
          )}

          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Bezig...' : 'Registreren'}
          </button>
        </form>
        <p style={{ marginTop: '1rem', textAlign: 'center' }}>
          <a href="/login">Al een account? Inloggen</a>
        </p>
      </div>
    </div>
  )
}