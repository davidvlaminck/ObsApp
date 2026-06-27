import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getKoepels, selectKoepel } from '../services/auth'
import type { UserResponse } from '../services/auth'

export default function KoepelSelectionPage() {
  const [koepels, setKoepels] = useState<Array<{ id: number; name: string; slug: string }>>([])
  const [selectedKoepel, setSelectedKoepel] = useState<string>('')
  const [selectedClass, setSelectedClass] = useState<string>('K3')  // Default to K3
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getKoepels()
        setKoepels(data)
      } catch {
        setError('Kon koepels niet laden. Probeer opnieuw.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!selectedKoepel) {
      setError('Selecteer een koepel')
      return
    }
    setSubmitting(true)
    try {
      const user: UserResponse = await selectKoepel(selectedKoepel, selectedClass)
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

  return (
    <div className="center-container">
      <div className="card">
        <h1>Kies je koepel en klas</h1>
        <p style={{ marginBottom: '1.5rem', color: '#6b7280' }}>
          Selecteer de koepel en klas die bij je school horen.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="koepel">Koepel</label>
            <select
              id="koepel"
              value={selectedKoepel}
              onChange={(e) => setSelectedKoepel(e.target.value)}
              required
              autoFocus
            >
              <option value="">-- Kies een koepel --</option>
              {koepels.map((k) => (
                <option key={k.id} value={k.slug}>
                  {k.name}
                </option>
              ))}
            </select>
          </div>
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
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Bezig...' : 'Opslaan'}
          </button>
        </form>
      </div>
    </div>
  )
}
