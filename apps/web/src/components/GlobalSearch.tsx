import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  AlertCircle,
  Bell,
  Server,
  Users,
  User,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import apiClient from '@/lib/api/client'
import type { Incident, Alert, Service, User as UserType } from '@/types/api'

interface Team {
  id: number
  name: string
  slug: string
  description: string | null
}

interface SearchResults {
  incidents: Array<{
    id: number
    incidentNumber: number
    title: string
    status: string
    severity: string
    serviceId: number
    triggeredAt: string
  }>
  alerts: Array<{
    id: number
    title: string
    description: string | null
    status: string
    severity: string
    firedAt: string
  }>
  services: Array<{
    id: number
    name: string
    slug: string
    description: string | null
    teamId: number
  }>
  teams: Team[]
  users: Array<{
    id: number
    name: string
    email: string
    role: string
  }>
}

interface GlobalSearchProps {
  isOpen: boolean
  onClose: () => void
}

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()

  // Calculate total results for keyboard navigation
  const flatResults = results
    ? [
        ...results.incidents.map((item) => ({ type: 'incident', data: item })),
        ...results.alerts.map((item) => ({ type: 'alert', data: item })),
        ...results.services.map((item) => ({ type: 'service', data: item })),
        ...results.teams.map((item) => ({ type: 'team', data: item })),
        ...results.users.map((item) => ({ type: 'user', data: item })),
      ]
    : []

  // Debounced search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setResults(null)
      return
    }

    setIsLoading(true)
    try {
      const response = await apiClient.get<SearchResults>('/search', {
        params: { q: searchQuery.trim(), limit: 5 },
      })
      setResults(response.data)
      setSelectedIndex(0)
    } catch (error) {
      console.error('Search error:', error)
      setResults(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Handle input change with debouncing
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query)
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [query, performSearch])

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % Math.max(flatResults.length, 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + flatResults.length) % Math.max(flatResults.length, 1))
          break
        case 'Enter':
          e.preventDefault()
          if (flatResults.length > 0) {
            handleSelectResult(flatResults[selectedIndex])
          }
          break
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, selectedIndex, flatResults])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleSelectResult = (result: { type: string; data: any }) => {
    switch (result.type) {
      case 'incident':
        navigate(`/incidents/${result.data.id}`)
        break
      case 'alert':
        // Alerts don't have their own detail page, so navigate to parent incident if available
        // For now, just navigate to alerts list
        navigate('/alerts')
        break
      case 'service':
        navigate(`/services/${result.data.id}`)
        break
      case 'team':
        navigate('/settings/teams')
        break
      case 'user':
        navigate('/settings/users')
        break
    }
    onClose()
    setQuery('')
    setResults(null)
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-status-critical'
      case 'high':
        return 'text-orange-400'
      case 'medium':
        return 'text-yellow-400'
      case 'low':
        return 'text-blue-400'
      default:
        return 'text-gray-400'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'triggered':
      case 'firing':
        return 'text-status-critical'
      case 'acknowledged':
        return 'text-yellow-400'
      case 'resolved':
        return 'text-status-operational'
      default:
        return 'text-gray-400'
    }
  }

  const renderResultItem = (
    icon: React.ReactNode,
    title: string,
    subtitle: string,
    badge?: React.ReactNode,
    isSelected: boolean = false
  ) => (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
        isSelected
          ? 'bg-accent-primary/10 border-l-2 border-accent-primary'
          : 'hover:bg-dark-700 border-l-2 border-transparent'
      )}
    >
      <div className="flex-shrink-0 text-dark-400">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-dark-50 truncate">{title}</p>
          {badge}
        </div>
        <p className="text-xs text-dark-400 truncate">{subtitle}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-dark-500 flex-shrink-0" />
    </div>
  )

  const hasResults =
    results &&
    (results.incidents.length > 0 ||
      results.alerts.length > 0 ||
      results.services.length > 0 ||
      results.teams.length > 0 ||
      results.users.length > 0)

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="relative w-full max-w-2xl bg-dark-800 border border-dark-700 rounded-xl shadow-2xl overflow-hidden"
            >
              {/* Search Input */}
              <div className="flex items-center gap-3 p-4 border-b border-dark-700">
                <Search className="h-5 w-5 text-dark-400 flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search incidents, alerts, services, teams, users..."
                  className="flex-1 bg-transparent text-dark-50 placeholder:text-dark-400 focus:outline-none text-sm"
                />
                {isLoading && <Loader2 className="h-4 w-4 text-dark-400 animate-spin" />}
                <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-mono text-dark-400 bg-dark-700 rounded border border-dark-600">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-[60vh] overflow-y-auto">
                {!query || query.length < 2 ? (
                  <div className="p-8 text-center text-dark-400 text-sm">
                    <Search className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>Type at least 2 characters to search</p>
                    <p className="text-xs mt-2">
                      Search across incidents, alerts, services, teams, and users
                    </p>
                  </div>
                ) : isLoading ? (
                  <div className="p-8 text-center text-dark-400 text-sm">
                    <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin" />
                    <p>Searching...</p>
                  </div>
                ) : !hasResults ? (
                  <div className="p-8 text-center text-dark-400 text-sm">
                    <Search className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>No results found for "{query}"</p>
                  </div>
                ) : (
                  <div className="py-2">
                    {/* Incidents */}
                    {results.incidents.length > 0 && (
                      <div className="mb-2">
                        <div className="px-4 py-2 text-xs font-semibold text-dark-400 uppercase tracking-wider">
                          Incidents
                        </div>
                        {results.incidents.map((incident, idx) => {
                          const globalIndex = idx
                          return (
                            <div
                              key={`incident-${incident.id}`}
                              onClick={() => handleSelectResult({ type: 'incident', data: incident })}
                            >
                              {renderResultItem(
                                <AlertCircle className="h-5 w-5" />,
                                `#${incident.incidentNumber} - ${incident.title}`,
                                new Date(incident.triggeredAt).toLocaleString(),
                                <span
                                  className={cn(
                                    'text-xs font-medium px-2 py-0.5 rounded',
                                    getSeverityColor(incident.severity)
                                  )}
                                >
                                  {incident.severity}
                                </span>,
                                selectedIndex === globalIndex
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Alerts */}
                    {results.alerts.length > 0 && (
                      <div className="mb-2">
                        <div className="px-4 py-2 text-xs font-semibold text-dark-400 uppercase tracking-wider">
                          Alerts
                        </div>
                        {results.alerts.map((alert, idx) => {
                          const globalIndex = results.incidents.length + idx
                          return (
                            <div
                              key={`alert-${alert.id}`}
                              onClick={() => handleSelectResult({ type: 'alert', data: alert })}
                            >
                              {renderResultItem(
                                <Bell className="h-5 w-5" />,
                                alert.title,
                                alert.description || 'No description',
                                <span
                                  className={cn(
                                    'text-xs font-medium px-2 py-0.5 rounded',
                                    getStatusColor(alert.status)
                                  )}
                                >
                                  {alert.status}
                                </span>,
                                selectedIndex === globalIndex
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Services */}
                    {results.services.length > 0 && (
                      <div className="mb-2">
                        <div className="px-4 py-2 text-xs font-semibold text-dark-400 uppercase tracking-wider">
                          Services
                        </div>
                        {results.services.map((service, idx) => {
                          const globalIndex =
                            results.incidents.length + results.alerts.length + idx
                          return (
                            <div
                              key={`service-${service.id}`}
                              onClick={() => handleSelectResult({ type: 'service', data: service })}
                            >
                              {renderResultItem(
                                <Server className="h-5 w-5" />,
                                service.name,
                                service.description || 'No description',
                                undefined,
                                selectedIndex === globalIndex
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Teams */}
                    {results.teams.length > 0 && (
                      <div className="mb-2">
                        <div className="px-4 py-2 text-xs font-semibold text-dark-400 uppercase tracking-wider">
                          Teams
                        </div>
                        {results.teams.map((team, idx) => {
                          const globalIndex =
                            results.incidents.length +
                            results.alerts.length +
                            results.services.length +
                            idx
                          return (
                            <div
                              key={`team-${team.id}`}
                              onClick={() => handleSelectResult({ type: 'team', data: team })}
                            >
                              {renderResultItem(
                                <Users className="h-5 w-5" />,
                                team.name,
                                team.description || 'No description',
                                undefined,
                                selectedIndex === globalIndex
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Users */}
                    {results.users.length > 0 && (
                      <div className="mb-2">
                        <div className="px-4 py-2 text-xs font-semibold text-dark-400 uppercase tracking-wider">
                          Users
                        </div>
                        {results.users.map((user, idx) => {
                          const globalIndex =
                            results.incidents.length +
                            results.alerts.length +
                            results.services.length +
                            results.teams.length +
                            idx
                          return (
                            <div
                              key={`user-${user.id}`}
                              onClick={() => handleSelectResult({ type: 'user', data: user })}
                            >
                              {renderResultItem(
                                <User className="h-5 w-5" />,
                                user.name,
                                user.email,
                                <span className="text-xs text-dark-400">{user.role}</span>,
                                selectedIndex === globalIndex
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-dark-700 bg-dark-900/50 text-xs text-dark-400">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 font-mono bg-dark-700 rounded border border-dark-600">↑</kbd>
                    <kbd className="px-1.5 py-0.5 font-mono bg-dark-700 rounded border border-dark-600">↓</kbd>
                    <span className="ml-1">Navigate</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 font-mono bg-dark-700 rounded border border-dark-600">↵</kbd>
                    <span className="ml-1">Select</span>
                  </div>
                </div>
                <div>
                  <kbd className="px-1.5 py-0.5 font-mono bg-dark-700 rounded border border-dark-600">ESC</kbd>
                  <span className="ml-1">Close</span>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

// Hook for keyboard shortcut
export function useGlobalSearchShortcut(callback: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        callback()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [callback])
}
