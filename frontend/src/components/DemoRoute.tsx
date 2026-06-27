import { ReactNode, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AxiosError } from 'axios'
import { clearToken, getMe } from '../services/auth'
import ForbiddenPage from '../pages/ForbiddenPage'

interface DemoRouteProps {
  children: ReactNode
}

export default function DemoRoute({ children }: DemoRouteProps) {
  const [isDemo, setIsDemo] = useState<boolean | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await getMe()
        setIsAuthenticated(true)
        setIsDemo(user.is_demo)
      } catch (error) {
        const axiosError = error as AxiosError
        if (axiosError.response?.status === 401) {
          clearToken()
          setIsAuthenticated(false)
          setIsDemo(false)
          navigate('/login')
          return
        }

        setIsAuthenticated(true)
        setIsDemo(false)
      }
    }

    loadCurrentUser()
  }, [navigate])

  if (isAuthenticated === null || isDemo === null) {
    return (
      <div className="center-container">
        <p>Laden...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  if (!isDemo) {
    return <ForbiddenPage />
  }

  return <>{children}</>
}