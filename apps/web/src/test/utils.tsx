import { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import type { User, Incident, Alert, DashboardMetrics } from '@/types/api'

// Mock data factories
export const createMockUser = (overrides?: Partial<User>): User => ({
  id: 1,
  email: 'test@example.com',
  name: 'Test User',
  externalId: 'ext-123',
  role: 'responder',
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
})

export const createMockIncident = (overrides?: Partial<Incident>): Incident => ({
  id: 1,
  incidentNumber: 1001,
  title: 'Test Incident',
  status: 'triggered',
  severity: 'high',
  serviceId: 1,
  triggeredAt: '2024-01-01T00:00:00Z',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  service: {
    id: 1,
    name: 'Test Service',
    slug: 'test-service',
    teamId: 1,
  },
  ...overrides,
})

export const createMockAlert = (overrides?: Partial<Alert>): Alert => ({
  id: 1,
  integrationId: 1,
  alertName: 'Test Alert',
  title: 'Test Alert Title',
  description: 'Test alert description',
  severity: 'critical',
  status: 'firing',
  source: 'prometheus',
  createdAt: '2024-01-01T00:00:00Z',
  startsAt: '2024-01-01T00:00:00Z',
  ...overrides,
})

export const createMockDashboardMetrics = (
  overrides?: Partial<DashboardMetrics>
): DashboardMetrics => ({
  activeCount: 5,
  mtta: '5m',
  mttr: '15m',
  severityBreakdown: {
    critical: 2,
    high: 3,
    medium: 5,
    low: 2,
    info: 1,
  },
  statusBreakdown: {
    triggered: 3,
    acknowledged: 2,
    resolved: 10,
  },
  onCallEngineer: {
    name: 'On-Call Engineer',
    email: 'oncall@example.com',
  },
  ...overrides,
})

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialRoute?: string
  queryClient?: QueryClient
}

export function renderWithProviders(
  ui: ReactElement,
  {
    initialRoute = '/',
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    }),
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  if (initialRoute !== '/') {
    window.history.pushState({}, 'Test page', initialRoute)
  }

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  )

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  }
}

// Mock store utilities
export const mockAuthStore = (overrides?: Partial<User>) => {
  const mockUser = createMockUser(overrides)
  return {
    user: mockUser,
    isAuthenticated: true,
    isLoading: false,
    error: null,
  }
}

// Wait for async updates
export const waitForLoadingToFinish = () =>
  new Promise((resolve) => setTimeout(resolve, 0))
