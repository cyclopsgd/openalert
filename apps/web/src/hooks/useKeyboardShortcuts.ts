import { useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useUIStore } from '@/stores/uiStore'

export interface KeyboardShortcut {
  key: string
  description: string
  action: () => void
  category: string
  modifiers?: {
    ctrl?: boolean
    meta?: boolean
    shift?: boolean
    alt?: boolean
  }
  sequence?: string[]
  displayKey?: string
  globalOnly?: boolean
}

interface UseKeyboardShortcutsOptions {
  shortcuts?: KeyboardShortcut[]
  enabled?: boolean
}

const isMac = typeof window !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { shortcuts = [], enabled = true } = options
  const navigate = useNavigate()
  const location = useLocation()
  const { openModal, closeModal } = useUIStore()
  const sequenceBufferRef = useRef<string[]>([])
  const sequenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const isInputElement = useCallback((element: EventTarget | null): boolean => {
    if (!element || !(element instanceof HTMLElement)) {
      return false
    }
    const tagName = element.tagName.toLowerCase()
    const isContentEditable = element.isContentEditable
    const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select'

    return isContentEditable || isInput
  }, [])

  const matchesModifiers = useCallback((
    event: KeyboardEvent,
    modifiers?: KeyboardShortcut['modifiers']
  ): boolean => {
    if (!modifiers) return true

    const ctrlOrMeta = modifiers.ctrl || modifiers.meta
    const eventCtrlOrMeta = event.ctrlKey || event.metaKey

    if (ctrlOrMeta && !eventCtrlOrMeta) return false
    if (!ctrlOrMeta && eventCtrlOrMeta) return false
    if (modifiers.shift && !event.shiftKey) return false
    if (!modifiers.shift && event.shiftKey) return false
    if (modifiers.alt && !event.altKey) return false
    if (!modifiers.alt && event.altKey) return false

    return true
  }, [])

  const handleSequence = useCallback((key: string, shortcuts: KeyboardShortcut[]) => {
    sequenceBufferRef.current.push(key.toLowerCase())

    if (sequenceTimeoutRef.current) {
      clearTimeout(sequenceTimeoutRef.current)
    }

    sequenceTimeoutRef.current = setTimeout(() => {
      sequenceBufferRef.current = []
    }, 1000)

    const sequenceStr = sequenceBufferRef.current.join(' ')

    for (const shortcut of shortcuts) {
      if (shortcut.sequence) {
        const expectedSequence = shortcut.sequence.join(' ').toLowerCase()
        if (sequenceStr === expectedSequence) {
          shortcut.action()
          sequenceBufferRef.current = []
          return true
        }
      }
    }

    return false
  }, [])

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    const target = event.target

    const isEscape = event.key === 'Escape'
    if (isEscape) {
      const openModals = Object.entries(useUIStore.getState().modals)
        .filter(([_, isOpen]) => isOpen)
        .map(([id]) => id)

      if (openModals.length > 0) {
        openModals.forEach(modalId => closeModal(modalId))
        event.preventDefault()
        return
      }
    }

    if (isInputElement(target) && !isEscape) {
      if (event.key === '/' && event.ctrlKey) {
        return
      }
      return
    }

    const allShortcuts = [...getDefaultShortcuts(), ...shortcuts]

    for (const shortcut of allShortcuts) {
      if (shortcut.sequence) {
        continue
      }

      const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase()
      const modifiersMatch = matchesModifiers(event, shortcut.modifiers)

      if (keyMatches && modifiersMatch) {
        event.preventDefault()
        shortcut.action()
        return
      }
    }

    if (!event.ctrlKey && !event.metaKey && !event.altKey) {
      handleSequence(event.key, allShortcuts)
    }
  }, [enabled, shortcuts, matchesModifiers, handleSequence, isInputElement, closeModal])

  const getDefaultShortcuts = useCallback((): KeyboardShortcut[] => {
    return [
      {
        key: 'k',
        description: 'Open global search',
        action: () => {
          const searchInput = document.querySelector('input[type="search"], input[placeholder*="Search" i], input[placeholder*="search" i]') as HTMLInputElement
          if (searchInput) {
            searchInput.focus()
            searchInput.select()
          }
        },
        category: 'General',
        modifiers: { ctrl: true, meta: true },
        displayKey: isMac ? '⌘K' : 'Ctrl+K',
        globalOnly: true,
      },
      {
        key: '/',
        description: 'Focus search input',
        action: () => {
          const searchInput = document.querySelector('input[type="search"], input[placeholder*="Search" i], input[placeholder*="search" i]') as HTMLInputElement
          if (searchInput) {
            searchInput.focus()
            searchInput.select()
          }
        },
        category: 'General',
        displayKey: '/',
      },
      {
        key: '?',
        description: 'Show keyboard shortcuts help',
        action: () => {
          openModal('keyboard-shortcuts')
        },
        category: 'General',
        displayKey: '?',
      },
      {
        key: 'd',
        description: 'Go to Dashboard',
        action: () => navigate('/'),
        category: 'Navigation',
        sequence: ['g', 'd'],
        displayKey: 'G then D',
      },
      {
        key: 'i',
        description: 'Go to Incidents',
        action: () => navigate('/incidents'),
        category: 'Navigation',
        sequence: ['g', 'i'],
        displayKey: 'G then I',
      },
      {
        key: 'a',
        description: 'Go to Alerts',
        action: () => navigate('/alerts'),
        category: 'Navigation',
        sequence: ['g', 'a'],
        displayKey: 'G then A',
      },
      {
        key: 's',
        description: 'Go to Services',
        action: () => navigate('/services'),
        category: 'Navigation',
        sequence: ['g', 's'],
        displayKey: 'G then S',
      },
      {
        key: 't',
        description: 'Go to Teams',
        action: () => navigate('/settings/teams'),
        category: 'Navigation',
        sequence: ['g', 't'],
        displayKey: 'G then T',
      },
      {
        key: 'c',
        description: 'Create new incident',
        action: () => {
          if (location.pathname === '/incidents') {
            openModal('create-incident')
          }
        },
        category: 'Actions',
        displayKey: 'C',
      },
      {
        key: 'Escape',
        description: 'Close modals/dialogs',
        action: () => {
          // Handled in main handleKeyDown
        },
        category: 'General',
        displayKey: 'Esc',
        globalOnly: true,
      },
    ]
  }, [navigate, openModal, location.pathname])

  useEffect(() => {
    if (!enabled) return

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (sequenceTimeoutRef.current) {
        clearTimeout(sequenceTimeoutRef.current)
      }
    }
  }, [handleKeyDown, enabled])

  const getAllShortcuts = useCallback((): KeyboardShortcut[] => {
    return [...getDefaultShortcuts(), ...shortcuts]
  }, [getDefaultShortcuts, shortcuts])

  return {
    shortcuts: getAllShortcuts(),
    isMac,
  }
}

export function formatShortcutKey(shortcut: KeyboardShortcut): string {
  if (shortcut.displayKey) {
    return shortcut.displayKey
  }

  const parts: string[] = []

  if (shortcut.modifiers?.ctrl || shortcut.modifiers?.meta) {
    parts.push(isMac ? '⌘' : 'Ctrl')
  }
  if (shortcut.modifiers?.shift) {
    parts.push(isMac ? '⇧' : 'Shift')
  }
  if (shortcut.modifiers?.alt) {
    parts.push(isMac ? '⌥' : 'Alt')
  }

  parts.push(shortcut.key.toUpperCase())

  return parts.join(isMac ? '' : '+')
}
