# Keyboard Shortcuts System

## Overview

OpenAlert implements a comprehensive keyboard shortcuts system to improve user productivity and accessibility. The system provides global shortcuts for navigation, search, and common actions.

## Features

- **Smart Context Awareness**: Shortcuts are disabled when typing in input fields
- **Modal Management**: ESC key automatically closes all open modals
- **Visual Feedback**: Tooltips display available shortcuts on buttons
- **Accessibility**: Full ARIA support and keyboard navigation
- **Platform Detection**: Automatically detects Mac vs Windows/Linux for proper key display
- **Sequence Shortcuts**: Support for multi-key sequences (e.g., "G then D")
- **Help Modal**: Press `?` to view all available shortcuts

## Architecture

### Components

1. **`useKeyboardShortcuts` Hook** (`apps/web/src/hooks/useKeyboardShortcuts.ts`)
   - Core keyboard event handling
   - Shortcut registration and matching
   - Sequence buffer management
   - Input element detection

2. **`KeyboardShortcutsHelp` Component** (`apps/web/src/components/KeyboardShortcutsHelp.tsx`)
   - Modal displaying all shortcuts
   - Grouped by category
   - Platform-specific key display

3. **`Tooltip` Component** (`apps/web/src/components/ui/Tooltip.tsx`)
   - Shows shortcut hints on buttons
   - Accessible with ARIA labels
   - Customizable position and delay

## Available Shortcuts

### General

| Shortcut | Description | Context |
|----------|-------------|---------|
| `Cmd/Ctrl + K` | Open global search | Global |
| `/` | Focus search input | Global |
| `?` | Show keyboard shortcuts help | Global |
| `Esc` | Close modals/dialogs | Global |

### Navigation

| Shortcut | Description |
|----------|-------------|
| `G` then `D` | Go to Dashboard |
| `G` then `I` | Go to Incidents |
| `G` then `A` | Go to Alerts |
| `G` then `S` | Go to Services |
| `G` then `T` | Go to Teams |

### Actions

| Shortcut | Description | Context |
|----------|-------------|---------|
| `C` | Create new incident | Incidents page |

## Implementation Guide

### Using the Hook

```typescript
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

function MyComponent() {
  // Enable keyboard shortcuts
  useKeyboardShortcuts()

  // With custom shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'n',
        description: 'Create new item',
        action: () => openCreateModal(),
        category: 'Actions',
        modifiers: { ctrl: true },
      }
    ],
    enabled: true, // Can conditionally disable
  })
}
```

### Adding Tooltips with Shortcuts

```typescript
import { Button } from '@/components/ui/Button'

function MyButton() {
  return (
    <Button
      tooltip="Save changes"
      shortcut="Cmd+S"
      onClick={handleSave}
    >
      Save
    </Button>
  )
}
```

### Custom Shortcut Definition

```typescript
interface KeyboardShortcut {
  key: string                    // The key to trigger
  description: string            // Human-readable description
  action: () => void            // Function to execute
  category: string              // Category for help modal
  modifiers?: {                 // Optional modifier keys
    ctrl?: boolean
    meta?: boolean
    shift?: boolean
    alt?: boolean
  }
  sequence?: string[]           // For multi-key sequences
  displayKey?: string           // Custom display text
  globalOnly?: boolean          // If true, works in input fields
}
```

## Technical Details

### Input Field Detection

The system automatically detects when the user is typing in input fields and disables most shortcuts:

```typescript
const isInputElement = (element: HTMLElement): boolean => {
  const tagName = element.tagName.toLowerCase()
  const isContentEditable = element.isContentEditable
  const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select'
  return isContentEditable || isInput
}
```

### Sequence Handling

Multi-key sequences have a 1-second timeout:

1. User presses `G`
2. System stores `g` in buffer
3. If user presses `D` within 1 second, triggers "Go to Dashboard"
4. If timeout expires, buffer is cleared

### Platform Detection

```typescript
const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)

// Display keys accordingly:
// Mac: ⌘ (Command), ⌥ (Option), ⇧ (Shift)
// Windows/Linux: Ctrl, Alt, Shift
```

### Modal Integration

The system integrates with the UI store's modal management:

```typescript
// Open modal
openModal('keyboard-shortcuts')

// Close all modals on ESC
const openModals = Object.entries(useUIStore.getState().modals)
  .filter(([_, isOpen]) => isOpen)
  .map(([id]) => id)

openModals.forEach(modalId => closeModal(modalId))
```

## Accessibility

### ARIA Support

- Modal has `role="dialog"` and `aria-labelledby`
- Keyboard shortcuts visible in tooltips
- Focus management for search inputs
- Clear visual indicators for active shortcuts

### Screen Reader Support

- All shortcuts have descriptive labels
- Tooltips use `aria-live="polite"`
- Help modal provides comprehensive text descriptions

## Testing

### Unit Tests

Run the test suite:

```bash
npm test -- useKeyboardShortcuts
```

Tests cover:
- ✓ Individual shortcut triggers
- ✓ Sequence shortcuts
- ✓ Input field detection
- ✓ Modal closure with ESC
- ✓ Platform detection
- ✓ Custom shortcuts
- ✓ Enable/disable functionality

### E2E Testing

```bash
npm run test:e2e
```

E2E tests verify:
- Real keyboard event handling
- Navigation shortcuts
- Search focus
- Modal interactions

## Best Practices

### Adding New Shortcuts

1. **Choose intuitive keys**: Use common patterns (G for "Go", C for "Create")
2. **Avoid conflicts**: Check existing shortcuts before adding new ones
3. **Document clearly**: Add to help modal and this documentation
4. **Test thoroughly**: Ensure no interference with native browser shortcuts
5. **Consider accessibility**: Ensure shortcuts work with screen readers

### Modifier Key Usage

- **Single keys** (`/`, `?`): Quick, common actions
- **Ctrl/Cmd + key**: Global actions (search, save)
- **Sequences** (`G` then `D`): Navigation to reduce single-key conflicts

### Context-Specific Shortcuts

Use conditional logic for page-specific shortcuts:

```typescript
{
  key: 'c',
  description: 'Create new incident',
  action: () => {
    if (location.pathname === '/incidents') {
      openModal('create-incident')
    }
  },
  category: 'Actions',
}
```

## Future Enhancements

Potential improvements:

- [ ] User-customizable shortcuts
- [ ] Shortcut recording/playback
- [ ] Conflict detection system
- [ ] Cheat sheet printable view
- [ ] Quick command palette (Cmd+K style)
- [ ] Shortcut usage analytics
- [ ] Global undo/redo shortcuts
- [ ] Accessibility settings for custom key mappings

## Browser Compatibility

- ✓ Chrome 90+
- ✓ Firefox 88+
- ✓ Safari 14+
- ✓ Edge 90+

Note: Some shortcuts may conflict with browser extensions. Users should disable conflicting extensions or customize shortcuts.

## Troubleshooting

### Shortcuts Not Working

1. Check if shortcuts are enabled: `useKeyboardShortcuts({ enabled: true })`
2. Verify you're not in an input field
3. Check browser console for errors
4. Ensure modal is not capturing events

### Conflicts with Browser Shortcuts

Some combinations are reserved by browsers:
- `Cmd/Ctrl + W` (Close tab)
- `Cmd/Ctrl + T` (New tab)
- `Cmd/Ctrl + R` (Reload)

Avoid these combinations or use sequences instead.

### Platform-Specific Issues

Mac users should use `Cmd` (⌘) instead of `Ctrl` for most shortcuts. The system automatically handles this, but ensure your custom shortcuts account for both platforms.

## Performance

The keyboard shortcuts system is optimized for performance:

- **Event delegation**: Single global listener
- **Lazy evaluation**: Shortcuts matched only on key press
- **Debounced sequences**: 1-second timeout prevents memory leaks
- **Conditional rendering**: Help modal only renders when open
- **No re-renders**: Hook doesn't trigger component updates

## License

Part of the OpenAlert project. See main LICENSE file.
