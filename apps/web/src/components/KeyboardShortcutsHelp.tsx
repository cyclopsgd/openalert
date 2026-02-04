import { useMemo } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useUIStore } from '@/stores/uiStore'
import { useKeyboardShortcuts, formatShortcutKey } from '@/hooks/useKeyboardShortcuts'
import type { KeyboardShortcut } from '@/hooks/useKeyboardShortcuts'
import { Keyboard, Command, Navigation, Zap } from 'lucide-react'

interface ShortcutsByCategory {
  [category: string]: KeyboardShortcut[]
}

const categoryIcons: { [key: string]: React.ReactNode } = {
  'General': <Command className="h-4 w-4" />,
  'Navigation': <Navigation className="h-4 w-4" />,
  'Actions': <Zap className="h-4 w-4" />,
}

export function KeyboardShortcutsHelp() {
  const { modals, closeModal } = useUIStore()
  const { shortcuts, isMac } = useKeyboardShortcuts({ enabled: false })
  const isOpen = modals['keyboard-shortcuts'] || false

  const shortcutsByCategory = useMemo((): ShortcutsByCategory => {
    return shortcuts.reduce((acc, shortcut) => {
      const category = shortcut.category || 'Other'
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(shortcut)
      return acc
    }, {} as ShortcutsByCategory)
  }, [shortcuts])

  const handleClose = () => {
    closeModal('keyboard-shortcuts')
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Keyboard Shortcuts"
      size="lg"
    >
      <div className="space-y-6" role="dialog" aria-labelledby="keyboard-shortcuts-title">
        <div className="flex items-center gap-2 text-dark-300 text-sm">
          <Keyboard className="h-4 w-4" />
          <p>
            Use these keyboard shortcuts to navigate and perform actions quickly.
          </p>
        </div>

        <div className="space-y-6">
          {Object.entries(shortcutsByCategory).map(([category, categoryShortcuts]) => (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-dark-400">
                  {categoryIcons[category] || <Keyboard className="h-4 w-4" />}
                </span>
                <h3 className="text-lg font-heading font-semibold text-dark-50">
                  {category}
                </h3>
              </div>

              <div className="space-y-2">
                {categoryShortcuts.map((shortcut, index) => (
                  <div
                    key={`${category}-${index}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-dark-900 border border-dark-700 hover:border-dark-600 transition-colors"
                  >
                    <span className="text-sm text-dark-200">
                      {shortcut.description}
                    </span>
                    <ShortcutKeyBadge shortcut={shortcut} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-dark-700">
          <div className="space-y-2 text-xs text-dark-400">
            <p>
              <span className="font-medium text-dark-300">Pro tip:</span> Shortcuts
              work on most pages except when typing in input fields.
            </p>
            {isMac ? (
              <p>
                <span className="font-medium text-dark-300">Mac users:</span> ⌘ =
                Command, ⌥ = Option, ⇧ = Shift
              </p>
            ) : (
              <p>
                <span className="font-medium text-dark-300">Windows/Linux users:</span>{' '}
                Ctrl = Control
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function ShortcutKeyBadge({ shortcut }: { shortcut: KeyboardShortcut }) {
  const keyDisplay = formatShortcutKey(shortcut)

  if (shortcut.sequence) {
    return (
      <div className="flex items-center gap-1">
        {shortcut.sequence.map((key, idx) => (
          <span key={idx} className="flex items-center gap-1">
            <kbd className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 font-mono text-xs font-semibold text-dark-100 bg-dark-800 border border-dark-600 rounded shadow-sm">
              {key.toUpperCase()}
            </kbd>
            {idx < shortcut.sequence!.length - 1 && (
              <span className="text-dark-500 text-xs font-medium">then</span>
            )}
          </span>
        ))}
      </div>
    )
  }

  const parts = keyDisplay.split('+')
  const isMacShortcut = keyDisplay.includes('⌘') || keyDisplay.includes('⌥') || keyDisplay.includes('⇧')

  if (parts.length > 1 && !isMacShortcut) {
    return (
      <div className="flex items-center gap-1">
        {parts.map((part, idx) => (
          <span key={idx} className="flex items-center gap-1">
            <kbd className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 font-mono text-xs font-semibold text-dark-100 bg-dark-800 border border-dark-600 rounded shadow-sm">
              {part}
            </kbd>
            {idx < parts.length - 1 && (
              <span className="text-dark-500 text-xs font-medium">+</span>
            )}
          </span>
        ))}
      </div>
    )
  }

  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 font-mono text-xs font-semibold text-dark-100 bg-dark-800 border border-dark-600 rounded shadow-sm">
      {keyDisplay}
    </kbd>
  )
}
