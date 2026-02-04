import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from '@/components/layout/Layout'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ToastContainer } from '@/components/ui/Toast'
import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

// Lazy load pages for code splitting
const Dashboard = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })))
const Incidents = lazy(() => import('@/pages/Incidents').then(m => ({ default: m.Incidents })))
const IncidentDetail = lazy(() => import('@/pages/IncidentDetail').then(m => ({ default: m.IncidentDetail })))
const Alerts = lazy(() => import('@/pages/Alerts').then(m => ({ default: m.Alerts })))
const Schedules = lazy(() => import('@/pages/Schedules').then(m => ({ default: m.Schedules })))
const ScheduleDetail = lazy(() => import('@/pages/ScheduleDetail').then(m => ({ default: m.ScheduleDetail })))
const ScheduleForm = lazy(() => import('@/pages/ScheduleForm').then(m => ({ default: m.ScheduleForm })))
const Login = lazy(() => import('@/pages/Login').then(m => ({ default: m.Login })))
const Services = lazy(() => import('@/pages/Services').then(m => ({ default: m.Services })))
const ServiceDetail = lazy(() => import('@/pages/ServiceDetail').then(m => ({ default: m.ServiceDetail })))
const ServiceForm = lazy(() => import('@/pages/ServiceForm').then(m => ({ default: m.ServiceForm })))
const PublicStatus = lazy(() => import('@/pages/PublicStatus').then(m => ({ default: m.PublicStatus })))
const StatusPages = lazy(() => import('@/pages/StatusPages').then(m => ({ default: m.StatusPages })))

// Lazy load settings pages (less frequently accessed)
const Settings = lazy(() => import('@/pages/settings/Settings').then(m => ({ default: m.Settings })))
const GeneralSettings = lazy(() => import('@/pages/settings/GeneralSettings').then(m => ({ default: m.GeneralSettings })))
const SSOSettings = lazy(() => import('@/pages/settings/SSOSettings').then(m => ({ default: m.SSOSettings })))
const UserManagement = lazy(() => import('@/pages/settings/UserManagement').then(m => ({ default: m.UserManagement })))
const IntegrationSettings = lazy(() => import('@/pages/settings/IntegrationSettings').then(m => ({ default: m.IntegrationSettings })))
const EscalationPolicies = lazy(() => import('@/pages/settings/EscalationPolicies').then(m => ({ default: m.EscalationPolicies })))
const NotificationSettings = lazy(() => import('@/pages/settings/NotificationSettings').then(m => ({ default: m.NotificationSettings })))
const TeamManagement = lazy(() => import('@/pages/settings/TeamManagement').then(m => ({ default: m.TeamManagement })))
const AlertRoutingRules = lazy(() => import('@/pages/settings/AlertRoutingRules').then(m => ({ default: m.AlertRoutingRules })))
const NotificationPreferences = lazy(() => import('@/pages/settings/NotificationPreferences').then(m => ({ default: m.NotificationPreferences })))

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center h-screen bg-dark-900">
    <div className="animate-spin h-8 w-8 border-4 border-accent-primary border-t-transparent rounded-full" />
  </div>
)

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
    return <PageLoader />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AppContent() {
  const { fetchProfile, isAuthenticated } = useAuthStore()
  const { theme } = useUIStore()

  useKeyboardShortcuts({ enabled: isAuthenticated })

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
    <>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/status/:slug" element={<PublicStatus />} />
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
            <Route path="services" element={<Services />} />
            <Route path="services/new" element={<ServiceForm />} />
            <Route path="services/:id" element={<ServiceDetail />} />
            <Route path="services/:id/edit" element={<ServiceForm />} />
            <Route path="status-pages" element={<StatusPages />} />
            <Route path="settings" element={<Settings />}>
              <Route index element={<Settings />} />
              <Route path="general" element={<GeneralSettings />} />
              <Route path="sso" element={<SSOSettings />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="teams" element={<TeamManagement />} />
              <Route path="integrations" element={<IntegrationSettings />} />
              <Route path="escalation-policies" element={<EscalationPolicies />} />
              <Route path="notifications" element={<NotificationSettings />} />
              <Route path="notification-preferences" element={<NotificationPreferences />} />
              <Route path="alert-routing" element={<AlertRoutingRules />} />
            </Route>
          </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
      <ToastContainer />
      <KeyboardShortcutsHelp />
    </>
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
