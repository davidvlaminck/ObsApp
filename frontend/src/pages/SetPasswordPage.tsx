import { AxiosError } from 'axios'
import { FormEvent, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { setPassword } from '../services/auth'

export default function SetPasswordPage() {
  const [searchParams] = useSearchParams()
  const [password, setPasswordValue] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (password !== confirmPassword) {
      setError('De wachtwoorden komen niet overeen.')
      return
    }

    const token = searchParams.get('token')
    if (!token) {
      setError('De activatielink is ongeldig.')
      return
    }

    setLoading(true)
    try {
      await setPassword({ token, password })
      setSuccess('Je wachtwoord is ingesteld. Je kunt nu inloggen.')
      setTimeout(() => navigate('/login'), 2000)
    } catch (error) {
      const axiosError = error as AxiosError<{ detail?: string }>
      setError(axiosError.response?.data?.detail ?? 'Kan wachtwoord niet instellen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="center-container">
      <div className="card">
        <div className="avatar">W</div>
        <h1>Wachtwoord instellen</h1>
        <p className="text-muted">Stel je wachtwoord in om je ObsApp-account te activeren.</p>

        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="new-password">Nieuw wachtwoord</label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPasswordValue(event.target.value)}
              minLength={8}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirm-password">Bevestig wachtwoord</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
              disabled={loading}
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Opslaan...' : 'Wachtwoord instellen'}
          </button>
        </form>
      </div>
    </div>
  )
}
