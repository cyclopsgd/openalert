import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ToastContainer } from '@/components/ui/Toast'

// Eager load critical components
import { Layout } from '@/components/layout/Layout'
import { Login } from '@/pages/Login'

// Lazy load all route components for code splitting
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Incidents = lazy(() => import('@/pages/Incidents'))
const IncidentDetail = lazy(() => import('@/pages/IncidentDetail'))
const Alerts = lazy(() => import('@/pages/Alerts'))
const Schedules = lazy(() => import('@/pages/Schedules'))
const ScheduleDetail = lazy(() => import('@/pages/ScheduleDetail'))
const ScheduleForm = lazy(() => import('@/pages/ScheduleForm'))
const Services = lazy(() => import('@/pages/Services'))
const ServiceDetail = lazy(() => import('@/pages/ServiceDetail'))
const ServiceForm = lazy(() => import('@/pages/ServiceForm'))
const PublicStatus = lazy(() => import('@/pages/PublicStatus'))
const StatusPages = lazy(() => import('@/pages/StatusPages'))

// Lazy load settings components
const Settings = lazy(() => import('@/pages/settings/Settings'))
const GeneralSettings = lazy(() => import('@/pages/settings/GeneralSettings'))
const SSOSettings = lazy(() => import('@/pages/settings/SSOSettings'))
const UserManagement = lazy(() => import('@/pages/settings/UserManagement'))
const IntegrationSettings = lazy(() => import('@/pages/settings/IntegrationSettings'))
const EscalationPolicies = lazy(() => import('@/pages/settings/EscalationPolicies'))
const NotificationSettings = lazy(() => import('@/pages/settings/NotificationSettings'))
const TeamManagement = lazy(() => import('@/pages/settings/TeamManagement'))
const AlertRoutingRules = lazy(() => import('@/pages/settings/AlertRoutingRules'))

// Configure query client with optimized defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000, // Consider data fresh for 30 seconds
      cacheTime: 300000, // Keep cache for 5 minutes
    },
  },
})

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen bg-dark-900">
      <div className="animate-spin h-8 w-8 border-4 border-accent-primary border-t-transparent rounded-full" />
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return <LoadingFallback />
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
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/status/:slug"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <PublicStatus />
              </Suspense>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route
              index
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <Dashboard />
                </Suspense>
              }
            />
            <Route
              path="incidents"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <Incidents />
                </Suspense>
              }
            />
            <Route
              path="incidents/:id"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <IncidentDetail />
                </Suspense>
              }
            />
            <Route
              path="alerts"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <Alerts />
                </Suspense>
              }
            />
            <Route
              path="schedules"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <Schedules />
                </Suspense>
              }
            />
            <Route
              path="schedules/new"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <ScheduleForm />
                </Suspense>
              }
            />
            <Route
              path="schedules/:id"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <ScheduleDetail />
                </Suspense>
              }
            />
            <Route
              path="schedules/:id/edit"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <ScheduleForm />
                </Suspense>
              }
            />
            <Route
              path="services"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <Services />
                </Suspense>
              }
            />
            <Route
              path="services/new"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <ServiceForm />
                </Suspense>
              }
            />
            <Route
              path="services/:id"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <ServiceDetail />
                </Suspense>
              }
            />
            <Route
              path="services/:id/edit"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <ServiceForm />
                </Suspense>
              }
            />
            <Route
              path="status-pages"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <StatusPages />
                </Suspense>
              }
            />
            <Route
              path="settings"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <Settings />
                </Suspense>
              }
            >
              <Route index element={<Settings />} />
              <Route
                path="general"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <GeneralSettings />
                  </Suspense>
                }
              />
              <Route
                path="sso"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <SSOSettings />
                  </Suspense>
                }
              />
              <Route
                path="users"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <UserManagement />
                  </Suspense>
                }
              />
              <Route
                path="teams"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <TeamManagement />
                  </Suspense>
                }
              />
              <Route
                path="integrations"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <IntegrationSettings />
                  </Suspense>
                }
              />
              <Route
                path="escalation-policies"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <EscalationPolicies />
                  </Suspense>
                }
              />
              <Route
                path="notifications"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <NotificationSettings />
                  </Suspense>
                }
              />
              <Route
                path="alert-routing"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <AlertRoutingRules />
                  </Suspense>
                }
              />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
      <ToastContainer />
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
