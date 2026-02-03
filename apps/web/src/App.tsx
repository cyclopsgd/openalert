import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from '@/components/layout/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Incidents } from '@/pages/Incidents'
import { IncidentDetail } from '@/pages/IncidentDetail'
import { Alerts } from '@/pages/Alerts'
import { Schedules } from '@/pages/Schedules'
import { ScheduleDetail } from '@/pages/ScheduleDetail'
import { ScheduleForm } from '@/pages/ScheduleForm'
import { Login } from '@/pages/Login'
import { Settings } from '@/pages/settings/Settings'
import { GeneralSettings } from '@/pages/settings/GeneralSettings'
import { SSOSettings } from '@/pages/settings/SSOSettings'
import { UserManagement } from '@/pages/settings/UserManagement'
import { IntegrationSettings } from '@/pages/settings/IntegrationSettings'
import { EscalationPolicies } from '@/pages/settings/EscalationPolicies'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-dark-900">
        <div className="animate-spin h-8 w-8 border-4 border-accent-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AppContent() {
  const { fetchProfile } = useAuthStore()
  const { theme } = useUIStore()

  useEffect(() => {
    const token = localStorage.getItem('authToken')
    if (token) {
      fetchProfile()
    }
  }, [fetchProfile])

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="incidents" element={<Incidents />} />
          <Route path="incidents/:id" element={<IncidentDetail />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="schedules" element={<Schedules />} />
          <Route path="schedules/new" element={<ScheduleForm />} />
          <Route path="schedules/:id" element={<ScheduleDetail />} />
          <Route path="schedules/:id/edit" element={<ScheduleForm />} />
          <Route path="status-pages" element={<div className="text-center py-12 text-dark-400">Status Pages coming soon</div>} />
          <Route path="settings" element={<Settings />}>
            <Route index element={<Settings />} />
            <Route path="general" element={<GeneralSettings />} />
            <Route path="sso" element={<SSOSettings />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="teams" element={<div className="text-center py-12 text-dark-400">Teams coming soon</div>} />
            <Route path="integrations" element={<IntegrationSettings />} />
            <Route path="escalation-policies" element={<EscalationPolicies />} />
            <Route path="notifications" element={<div className="text-center py-12 text-dark-400">Notifications coming soon</div>} />
            <Route path="alert-routing" element={<div className="text-center py-12 text-dark-400">Alert Routing coming soon</div>} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
