import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getMe, clearToken, UserResponse } from '../services/auth'

export default function LandingPage() {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await getMe()
        setUser(data)
      } catch {
        setError('Sessie verlopen. Log opnieuw in.')
        clearToken()
        navigate('/login')
      }
    }
    fetchUser()
  }, [navigate])

  const handleLogout = () => {
    clearToken()
    navigate('/login')
  }

  if (error) {
    return (
      <div className="center-container">
        <p className="error">{error}</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="center-container">
        <p>Laden...</p>
      </div>
    )
  }

  return (
    <div className="center-container">
      <div className="card">
        <div className="avatar">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <h1>Welkom, {user.name}!</h1>
        <p>Je bent succesvol ingelogd als {user.email}.</p>
        {user.school_id && (
          <p className="text-sm text-muted">School ID: {user.school_id}</p>
        )}
        {user.is_superuser && (
          <div className="admin-links">
            <Link to="/schools">Schoolbeheer</Link>
            <Link to="/users">Gebruikersbeheer</Link>
          </div>
        )}
        <button className="btn btn-outline" onClick={handleLogout}>
          Uitloggen
        </button>
      </div>
    </div>
  )
}
