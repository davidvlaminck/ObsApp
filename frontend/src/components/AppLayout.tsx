import { AxiosError } from 'axios'
import { ReactNode, useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { clearToken, getMe, UserResponse } from '../services/auth'

interface AppLayoutProps {
  children: ReactNode
}

interface MenuItem {
  label: string
  to: string
  icon: string
  adminOnly?: boolean
}

const menuItems: MenuItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: 'dashboard' },
  { label: 'Observaties', to: '/observations', icon: 'assignment' },
  { label: 'Scholen', to: '/schools', icon: 'school', adminOnly: true },
  { label: 'Gebruikers', to: '/users', icon: 'people', adminOnly: true },
]

function MenuIcon({ icon }: { icon: string }) {
  if (icon === 'dashboard') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    )
  }

  if (icon === 'assignment') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 5h10" />
        <path d="M9 9h10" />
        <path d="M9 13h6" />
        <path d="M5 3v18" />
        <path d="M9 17h8" />
      </svg>
    )
  }

  if (icon === 'school') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 21h18" />
        <path d="M5 21V7l7-4 7 4v14" />
        <path d="M9 21v-6h6v6" />
      </svg>
    )
  }

  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        setUser(await getMe())
      } catch (error) {
        const axiosError = error as AxiosError
        if (axiosError.response?.status === 401) {
          clearToken()
          navigate('/login')
          return
        }
        clearToken()
        navigate('/login')
      }
    }

    loadCurrentUser()
  }, [navigate])

  const visibleItems = menuItems.filter((item) => !item.adminOnly || user?.is_superuser)

  const handleLogout = () => {
    clearToken()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${drawerOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">O</div>
          <div>
            <strong>ObsApp</strong>
            <span>{user?.school_id ? 'Schoolomgeving' : 'Beheer'}</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Hoofdmenu">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
              onClick={() => setDrawerOpen(false)}
            >
              <MenuIcon icon={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{user?.name?.charAt(0) ?? 'U'}</div>
            <div>
              <strong>{user?.name ?? 'Gebruiker'}</strong>
              <span>{user?.is_superuser ? 'Admin' : 'Leerkracht'}</span>
            </div>
          </div>
          <button className="btn btn-outline btn-full" type="button" onClick={handleLogout}>
            Uitloggen
          </button>
        </div>
      </aside>

      <div className={`drawer-backdrop ${drawerOpen ? 'drawer-backdrop-open' : ''}`} onClick={() => setDrawerOpen(false)} />

      <header className="mobile-topbar">
        <button className="icon-button" type="button" onClick={() => setDrawerOpen(true)} aria-label="Menu openen">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18" />
            <path d="M3 12h18" />
            <path d="M3 18h18" />
          </svg>
        </button>
        <strong>{location.pathname === '/dashboard' ? 'Dashboard' : 'ObsApp'}</strong>
        <button className="icon-button" type="button" onClick={handleLogout} aria-label="Uitloggen">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
        </button>
      </header>

      <main className="app-content">{children}</main>
    </div>
  )
}
