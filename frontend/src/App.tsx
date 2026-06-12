import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import SuperuserRoute from './components/SuperuserRoute'
import LoginPage from './pages/LoginPage'
import LandingPage from './pages/LandingPage'
import SchoolsPage from './pages/SchoolsPage'
import UsersPage from './pages/UsersPage'
import SetPasswordPage from './pages/SetPasswordPage'
import DashboardPage from './pages/DashboardPage'
import ObservationsPage from './pages/ObservationsPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/set-password" element={<SetPasswordPage />} />

      <Route
        path="/dashboard"
        element={
          <AppLayout>
            <DashboardPage />
          </AppLayout>
        }
      />
      <Route
        path="/observations"
        element={
          <AppLayout>
            <ObservationsPage />
          </AppLayout>
        }
      />
      <Route
        path="/schools"
        element={
          <AppLayout>
            <SuperuserRoute>
              <SchoolsPage />
            </SuperuserRoute>
          </AppLayout>
        }
      />
      <Route
        path="/users"
        element={
          <AppLayout>
            <SuperuserRoute>
              <UsersPage />
            </SuperuserRoute>
          </AppLayout>
        }
      />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
