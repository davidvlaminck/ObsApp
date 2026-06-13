import { ReactNode, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AxiosError } from 'axios'
import { clearToken, getMe } from '../services/auth'
import ForbiddenPage from '../pages/ForbiddenPage'

interface SchoolAccessRouteProps {
  children: ReactNode
}

export default function SchoolAccessRoute({ children }: SchoolAccessRouteProps) {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await getMe()
        setIsAuthenticated(true)
        const hasSchoolAccess = user.is_superuser || Boolean(user.school_id)
        setHasAccess(hasSchoolAccess)
      } catch (error) {
        const axiosError = error as AxiosError
        if (axiosError.response?.status === 401) {
          clearToken()
          setIsAuthenticated(false)
          setHasAccess(false)
          navigate('/login')
          return
        }

        setIsAuthenticated(true)
        setHasAccess(false)
      }
    }

    loadCurrentUser()
  }, [navigate])

  if (isAuthenticated === null || hasAccess === null) {
    return (
      <div className="center-container">
        <p>Laden...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  if (!hasAccess) {
    return <ForbiddenPage />
  }

  return <>{children}</>
}
