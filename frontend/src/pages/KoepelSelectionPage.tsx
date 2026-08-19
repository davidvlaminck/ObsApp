import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearToken, getKoepels, getMe, selectKoepel, searchSchools } from '../services/auth'
import type { UserResponse, SchoolResponse } from '../services/auth'

export default function KoepelSelectionPage() {
  const [koepels, setKoepels] = useState<Array<{ id: number; name: string; slug: string }>>([])
  const [selectedKoepel, setSelectedKoepel] = useState<string>('')
  const [selectedClass, setSelectedClass] = useState<string>('K3')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [currentUser, setCurrentUser] = useState<UserResponse | null>(null)
  const [schoolQuery, setSchoolQuery] = useState('')
  const [schoolResults, setSchoolResults] = useState<SchoolResponse[]>([])
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null)
  const [selectedSchool, setSelectedSchool] = useState<SchoolResponse | null>(null)
  const [searchingSchools, setSearchingSchools] = useState(false)
  const navigate = useNavigate()
  const searchTimerRef = useRef<number | null>(null)

  const handleLogout = () => {
    clearToken()
    navigate('/login')
  }

  useEffect(() => {
    const load = async () => {
      try {
        const [koepelsData, me] = await Promise.all([
          getKoepels(),
          getMe(),
        ])
        setKoepels(koepelsData)
        setCurrentUser(me)
      } catch {
        setError('Kon gegevens niet laden. Probeer opnieuw.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSchoolSearch = async (query: string) => {
    setSchoolQuery(query)
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
    }
    if (!query || query.trim().length < 2) {
      setSchoolResults([])
      return
    }
    searchTimerRef.current = window.setTimeout(async () => {
      setSearchingSchools(true)
      try {
        const results = await searchSchools(query.trim())
        setSchoolResults(results)
      } catch {
        setSchoolResults([])
      } finally {
        setSearchingSchools(false)
      }
    }, 300)
  }

  const handleSelectSchool = (school: SchoolResponse) => {
    setSelectedSchoolId(school.id)
    setSelectedSchool(school)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const schoolHasKoepel = Boolean(selectedSchool?.koepel)
    if (!schoolHasKoepel && !selectedKoepel) {
      setError('Selecteer een koepel')
      return
    }
    setSubmitting(true)
    try {
      const user: UserResponse = await selectKoepel(
        selectedKoepel || selectedSchool?.koepel || '',
        selectedSchoolId || undefined,
        selectedClass,
      )
      if (user.is_demo) {
        navigate('/demo')
      } else {
        navigate('/home')
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Koepel selectie mislukt. Probeer opnieuw.')
    } finally {
      setSubmitting(false)
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

  const isDemo = currentUser?.is_demo
  const hasExistingSchool = currentUser?.school_id && !isDemo
  const needsSchoolSelection = !isDemo && !hasExistingSchool
  const isPending = currentUser?.membership_pending && !isDemo

  return (
    <div className="center-container">
      <div className="card" style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={handleLogout}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            padding: '0.4rem 0.8rem',
            fontSize: '0.85rem',
            cursor: 'pointer',
            color: '#374151',
          }}
        >
          Uitloggen
        </button>
        <h1>Kies je school en koepel</h1>
        <p style={{ marginBottom: '1.5rem', color: '#6b7280' }}>
          Selecteer eerst je school, daarna de koepel en klas die bij je school horen.
        </p>

        {isPending && (
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '0.5rem' }}>
            <p style={{ margin: 0, color: '#92400e' }}>
              Je verzoek om toegang tot de school is in behandeling. Wacht op goedkeuring van een beheerder of bestaand lid.
            </p>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          {needsSchoolSelection && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label htmlFor="school-search">Zoek je school</label>
                <input
                  id="school-search"
                  type="text"
                  value={schoolQuery}
                  onChange={(e) => handleSchoolSearch(e.target.value)}
                  placeholder="Zoek op naam of adres (min. 2 tekens)"
                  autoFocus
                />
              </div>

              {schoolResults.length > 0 && (
                <div style={{ marginTop: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Naam</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Adres</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', width: '100px' }}>Actie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schoolResults.map((school) => (
                        <tr key={school.id} style={{ background: selectedSchoolId === school.id ? '#eff6ff' : 'white' }}>
                          <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>
                            {school.name}
                            {school.city && <span style={{ color: '#6b7280', fontSize: '0.8rem', display: 'block' }}>{school.postal_code} {school.city}</span>}
                          </td>
                          <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>
                            {school.address || '-'}
                          </td>
                          <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{
                                background: selectedSchoolId === school.id ? '#2563eb' : '#e5e7eb',
                                color: selectedSchoolId === school.id ? 'white' : '#374151',
                                padding: '0.25rem 0.75rem',
                                fontSize: '0.8rem',
                              }}
                               onClick={() => handleSelectSchool(school)}
                            >
                              {selectedSchoolId === school.id ? 'Geselecteerd' : 'Kies'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {searchingSchools && <p style={{ marginTop: '0.5rem', color: '#6b7280', fontSize: '0.85rem' }}>Zoeken...</p>}
              {schoolQuery.length >= 2 && schoolResults.length === 0 && !searchingSchools && (
                <p style={{ marginTop: '0.5rem', color: '#6b7280', fontSize: '0.85rem' }}>Geen scholen gevonden.</p>
              )}

              {needsSchoolSelection && (
                <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: selectedSchoolId ? '#059669' : '#dc2626' }}>
                  {selectedSchoolId ? 'School geselecteerd. Kies nu je koepel.' : 'Selecteer eerst een school uit de resultaten.'}
                </p>
              )}
            </div>
          )}

          {(!needsSchoolSelection || selectedSchoolId) && (
            <>
              <div className="form-group">
                <label htmlFor="koepel">Koepel</label>
                <select
                  id="koepel"
                  value={selectedKoepel}
                  onChange={(e) => setSelectedKoepel(e.target.value)}
                  required={!selectedSchool?.koepel}
                  disabled={Boolean(selectedSchool?.koepel)}
                  autoFocus={!needsSchoolSelection}
                >
                  <option value="">-- Kies een koepel --</option>
                  {koepels.map((k) => (
                    <option key={k.id} value={k.slug}>
                      {k.name}
                    </option>
                  ))}
                </select>
                {selectedSchool?.koepel && (
                  <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#6b7280' }}>
                    Deze school heeft al een koepel ingesteld.
                  </p>
                )}
              </div>
              {!isDemo && (
                <div className="form-group">
                  <label htmlFor="class">Klas</label>
                  <select
                    id="class"
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    required
                  >
                    <option value="JK">JK (Jongste kleuters)</option>
                    <option value="K2">2K (Tweede kleuterklas)</option>
                    <option value="K3">3K (Derde kleuterklas)</option>
                  </select>
                </div>
              )}
              {error && <p className="error">{error}</p>}
              <button type="submit" className="btn btn-primary" disabled={submitting || (needsSchoolSelection && !selectedSchoolId) || isPending}>
                {submitting ? 'Bezig...' : isPending ? 'Wacht op goedkeuring' : 'Opslaan'}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
