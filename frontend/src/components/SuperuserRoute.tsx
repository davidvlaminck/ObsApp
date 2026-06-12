import { ReactNode, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AxiosError } from 'axios'
import { clearToken, getMe } from '../services/auth'
import ForbiddenPage from '../pages/ForbiddenPage'

interface SuperuserRouteProps {
  children: ReactNode
}

export default function SuperuserRoute({ children }: SuperuserRouteProps) {
  const [isSuperuser, setIsSuperuser] = useState<boolean | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await getMe()
        setIsAuthenticated(true)
        setIsSuperuser(user.is_superuser)
      } catch (error) {
        const axiosError = error as AxiosError
        if (axiosError.response?.status === 401) {
          clearToken()
          setIsAuthenticated(false)
          setIsSuperuser(false)
          navigate('/login')
          return
        }

        setIsAuthenticated(true)
        setIsSuperuser(false)
      }
    }

    loadCurrentUser()
  }, [navigate])

  if (isAuthenticated === null || isSuperuser === null) {
    return (
      <div className="center-container">
        <p>Laden...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  if (!isSuperuser) {
    return <ForbiddenPage />
  }

  return <>{children}</>
}
