import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import SuperuserRoute from './components/SuperuserRoute'
import SchoolAccessRoute from './components/SchoolAccessRoute'
import LoginPage from './pages/LoginPage'
import LandingPage from './pages/LandingPage'
import SchoolsPage from './pages/SchoolsPage'
import ManagementPage from './pages/ManagementPage'
import UsersPage from './pages/UsersPage'
import SetPasswordPage from './pages/SetPasswordPage'
import DashboardPage from './pages/DashboardPage'
import ObservationsPage from './pages/ObservationsPage'
import ObservingPage from './pages/ObservingPage'
import OverviewPage from './pages/OverviewPage'
import StudentOverviewPage from './pages/StudentOverviewPage'
import RegistrationPage from './pages/RegistrationPage'
import KoepelSelectionPage from './pages/KoepelSelectionPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegistrationPage />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/set-password" element={<SetPasswordPage />} />
      <Route path="/select-koepel" element={<KoepelSelectionPage />} />

      <Route
        path="/dashboard"
        element={
          <AppLayout>
            <DashboardPage />
          </AppLayout>
        }
      />
      <Route
        path="/overzicht"
        element={
          <AppLayout>
            <OverviewPage />
          </AppLayout>
        }
      />
      <Route
        path="/overzicht/leerling"
        element={
          <AppLayout>
            <StudentOverviewPage />
          </AppLayout>
        }
      />
      <Route
        path="/observeren"
        element={
          <AppLayout>
            <ObservingPage />
          </AppLayout>
        }
      />
      <Route
        path="/management/observations"
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
            <SchoolAccessRoute>
              <SchoolsPage />
            </SchoolAccessRoute>
          </AppLayout>
        }
      />
      <Route
        path="/management/classes"
        element={
          <AppLayout>
            <SchoolAccessRoute>
              <ManagementPage />
            </SchoolAccessRoute>
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
