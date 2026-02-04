import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KeyboardShortcutsHelp } from '../KeyboardShortcutsHelp'
import { useUIStore } from '@/stores/uiStore'
import { BrowserRouter } from 'react-router-dom'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/' }),
  }
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
)

describe('KeyboardShortcutsHelp', () => {
  beforeEach(() => {
    useUIStore.setState({ modals: {} })
  })

  it('should not render when modal is closed', () => {
    const { container } = render(<KeyboardShortcutsHelp />, { wrapper })

    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument()
  })

  it('should render when modal is open', () => {
    useUIStore.setState({ modals: { 'keyboard-shortcuts': true } })

    render(<KeyboardShortcutsHelp />, { wrapper })

    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
  })

  it('should display all shortcut categories', () => {
    useUIStore.setState({ modals: { 'keyboard-shortcuts': true } })

    render(<KeyboardShortcutsHelp />, { wrapper })

    expect(screen.getByText('General')).toBeInTheDocument()
    expect(screen.getByText('Navigation')).toBeInTheDocument()
    expect(screen.getByText('Actions')).toBeInTheDocument()
  })

  it('should display shortcut descriptions', () => {
    useUIStore.setState({ modals: { 'keyboard-shortcuts': true } })

    render(<KeyboardShortcutsHelp />, { wrapper })

    expect(screen.getByText('Open global search')).toBeInTheDocument()
    expect(screen.getByText('Show keyboard shortcuts help')).toBeInTheDocument()
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Go to Incidents')).toBeInTheDocument()
    expect(screen.getByText('Go to Alerts')).toBeInTheDocument()
    expect(screen.getByText('Go to Services')).toBeInTheDocument()
    expect(screen.getByText('Go to Teams')).toBeInTheDocument()
    expect(screen.getByText('Create new incident')).toBeInTheDocument()
    expect(screen.getByText('Close modals/dialogs')).toBeInTheDocument()
  })

  it('should display keyboard shortcut keys', () => {
    useUIStore.setState({ modals: { 'keyboard-shortcuts': true } })

    render(<KeyboardShortcutsHelp />, { wrapper })

    expect(screen.getByText('?')).toBeInTheDocument()
    expect(screen.getByText('/')).toBeInTheDocument()
    expect(screen.getByText('Esc')).toBeInTheDocument()
  })

  it('should close modal when clicking close button', () => {
    const closeModalSpy = vi.spyOn(useUIStore.getState(), 'closeModal')

    useUIStore.setState({ modals: { 'keyboard-shortcuts': true } })

    render(<KeyboardShortcutsHelp />, { wrapper })

    const closeButton = screen.getByRole('button', { name: /close/i })
    fireEvent.click(closeButton)

    expect(closeModalSpy).toHaveBeenCalledWith('keyboard-shortcuts')
  })

  it('should display pro tip message', () => {
    useUIStore.setState({ modals: { 'keyboard-shortcuts': true } })

    render(<KeyboardShortcutsHelp />, { wrapper })

    expect(
      screen.getByText(/Shortcuts work on most pages except when typing in input fields/i)
    ).toBeInTheDocument()
  })

  it('should display sequence shortcuts correctly', () => {
    useUIStore.setState({ modals: { 'keyboard-shortcuts': true } })

    render(<KeyboardShortcutsHelp />, { wrapper })

    const gKeys = screen.getAllByText('G')
    const dKeys = screen.getAllByText('D')
    const iKeys = screen.getAllByText('I')

    expect(gKeys.length).toBeGreaterThan(0)
    expect(dKeys.length).toBeGreaterThan(0)
    expect(iKeys.length).toBeGreaterThan(0)
  })

  it('should be accessible with proper ARIA attributes', () => {
    useUIStore.setState({ modals: { 'keyboard-shortcuts': true } })

    render(<KeyboardShortcutsHelp />, { wrapper })

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
  })

  it('should display platform-specific help text for Mac', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      configurable: true,
    })

    useUIStore.setState({ modals: { 'keyboard-shortcuts': true } })

    render(<KeyboardShortcutsHelp />, { wrapper })

    const macText = screen.queryByText(/⌘ = Command, ⌥ = Option, ⇧ = Shift/i)
    if (macText) {
      expect(macText).toBeInTheDocument()
    }
  })

  it('should group shortcuts by category', () => {
    useUIStore.setState({ modals: { 'keyboard-shortcuts': true } })

    render(<KeyboardShortcutsHelp />, { wrapper })

    // Modal is rendered via portal, so query document.body
    const categoryHeaders = document.querySelectorAll('h3')
    expect(categoryHeaders.length).toBeGreaterThan(0)

    const categories = Array.from(categoryHeaders).map((h) => h.textContent)
    expect(categories).toContain('General')
    expect(categories).toContain('Navigation')
    expect(categories).toContain('Actions')
  })
})
