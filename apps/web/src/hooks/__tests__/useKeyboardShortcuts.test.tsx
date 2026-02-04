import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { useKeyboardShortcuts } from '../useKeyboardShortcuts'
import { useUIStore } from '@/stores/uiStore'
import type { ReactNode } from 'react'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/incidents' }),
  }
})

const wrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
)

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useUIStore.setState({ modals: {} })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with default shortcuts', () => {
    const { result } = renderHook(() => useKeyboardShortcuts(), { wrapper })

    expect(result.current.shortcuts).toBeDefined()
    expect(result.current.shortcuts.length).toBeGreaterThan(0)
  })

  it('should detect platform (Mac vs Windows)', () => {
    const { result } = renderHook(() => useKeyboardShortcuts(), { wrapper })

    expect(typeof result.current.isMac).toBe('boolean')
  })

  it('should include all expected shortcut categories', () => {
    const { result } = renderHook(() => useKeyboardShortcuts(), { wrapper })

    const categories = new Set(result.current.shortcuts.map(s => s.category))
    expect(categories.has('General')).toBe(true)
    expect(categories.has('Navigation')).toBe(true)
    expect(categories.has('Actions')).toBe(true)
  })

  it('should include navigation shortcuts', () => {
    const { result } = renderHook(() => useKeyboardShortcuts(), { wrapper })

    const descriptions = result.current.shortcuts.map(s => s.description)
    expect(descriptions).toContain('Go to Dashboard')
    expect(descriptions).toContain('Go to Incidents')
    expect(descriptions).toContain('Go to Alerts')
    expect(descriptions).toContain('Go to Services')
    expect(descriptions).toContain('Go to Teams')
  })

  it('should include general shortcuts', () => {
    const { result } = renderHook(() => useKeyboardShortcuts(), { wrapper })

    const descriptions = result.current.shortcuts.map(s => s.description)
    expect(descriptions).toContain('Open global search')
    expect(descriptions).toContain('Show keyboard shortcuts help')
    expect(descriptions).toContain('Focus search input')
    expect(descriptions).toContain('Close modals/dialogs')
  })

  it('should include action shortcuts', () => {
    const { result } = renderHook(() => useKeyboardShortcuts(), { wrapper })

    const descriptions = result.current.shortcuts.map(s => s.description)
    expect(descriptions).toContain('Create new incident')
  })

  it('should respect enabled flag', () => {
    const { result: enabled } = renderHook(() => useKeyboardShortcuts({ enabled: true }), { wrapper })
    const { result: disabled } = renderHook(() => useKeyboardShortcuts({ enabled: false }), { wrapper })

    expect(enabled.current.shortcuts.length).toBeGreaterThan(0)
    expect(disabled.current.shortcuts.length).toBeGreaterThan(0)
  })

  it('should support custom shortcuts', () => {
    const customAction = vi.fn()
    const customShortcuts = [
      {
        key: 't',
        description: 'Test action',
        action: customAction,
        category: 'Test',
        modifiers: { ctrl: true } as const,
      },
    ]

    const { result } = renderHook(() => useKeyboardShortcuts({ shortcuts: customShortcuts }), { wrapper })

    expect(result.current.shortcuts).toContainEqual(
      expect.objectContaining({
        key: 't',
        description: 'Test action',
        category: 'Test',
      })
    )
  })

  it('should have sequence shortcuts for navigation', () => {
    const { result } = renderHook(() => useKeyboardShortcuts(), { wrapper })

    const sequenceShortcuts = result.current.shortcuts.filter(s => s.sequence)
    expect(sequenceShortcuts.length).toBeGreaterThan(0)

    const dashboardShortcut = sequenceShortcuts.find(s => s.description === 'Go to Dashboard')
    expect(dashboardShortcut?.sequence).toEqual(['g', 'd'])

    const incidentsShortcut = sequenceShortcuts.find(s => s.description === 'Go to Incidents')
    expect(incidentsShortcut?.sequence).toEqual(['g', 'i'])
  })

  it('should have proper display keys for shortcuts', () => {
    const { result } = renderHook(() => useKeyboardShortcuts(), { wrapper })

    const helpShortcut = result.current.shortcuts.find(s => s.description === 'Show keyboard shortcuts help')
    expect(helpShortcut?.displayKey).toBe('?')

    const searchShortcut = result.current.shortcuts.find(s => s.description === 'Focus search input')
    expect(searchShortcut?.displayKey).toBe('/')

    const escapeShortcut = result.current.shortcuts.find(s => s.description === 'Close modals/dialogs')
    expect(escapeShortcut?.displayKey).toBe('Esc')
  })

  it('should mark global shortcuts correctly', () => {
    const { result } = renderHook(() => useKeyboardShortcuts(), { wrapper })

    const globalShortcuts = result.current.shortcuts.filter(s => s.globalOnly)
    expect(globalShortcuts.length).toBeGreaterThan(0)

    const globalSearchShortcut = globalShortcuts.find(s => s.description === 'Open global search')
    expect(globalSearchShortcut).toBeDefined()

    const escapeShortcut = globalShortcuts.find(s => s.description === 'Close modals/dialogs')
    expect(escapeShortcut).toBeDefined()
  })

  it('should clean up event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => useKeyboardShortcuts(), { wrapper })

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
  })
})
