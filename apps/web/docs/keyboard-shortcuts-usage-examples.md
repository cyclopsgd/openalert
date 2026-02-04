# Keyboard Shortcuts Usage Examples

This document provides practical examples of how to use the keyboard shortcuts system in OpenAlert.

## Basic Usage

### 1. Enable Keyboard Shortcuts in Your App

The keyboard shortcuts are already enabled in the main App component for authenticated users:

```typescript
// apps/web/src/App.tsx
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

function AppContent() {
  const { isAuthenticated } = useAuthStore()

  // Enable shortcuts only when user is authenticated
  useKeyboardShortcuts({ enabled: isAuthenticated })

  // ... rest of your app
}
```

### 2. Add Tooltips with Shortcuts to Buttons

```typescript
import { Button } from '@/components/ui/Button'

function MyComponent() {
  return (
    <div>
      {/* Button with tooltip showing keyboard shortcut */}
      <Button
        onClick={handleSave}
        tooltip="Save changes"
        shortcut="Cmd+S"
      >
        Save
      </Button>

      {/* Another example */}
      <Button
        onClick={handleDelete}
        tooltip="Delete item"
        shortcut="Del"
        variant="danger"
      >
        Delete
      </Button>
    </div>
  )
}
```

### 3. Add Custom Page-Specific Shortcuts

```typescript
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

function IncidentsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Add custom shortcuts for this page
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'n',
        description: 'Create new incident',
        action: () => setShowCreateModal(true),
        category: 'Incidents',
        modifiers: { ctrl: true },
        displayKey: 'Ctrl+N',
      },
      {
        key: 'r',
        description: 'Refresh incidents list',
        action: () => refetchIncidents(),
        category: 'Incidents',
        displayKey: 'R',
      },
    ],
  })

  return (
    <div>
      {/* Your page content */}
    </div>
  )
}
```

### 4. Add Keyboard Shortcuts Help to Your Layout

The keyboard shortcuts help modal is already included in the App component:

```typescript
// apps/web/src/App.tsx
import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp'

function AppContent() {
  return (
    <>
      <BrowserRouter>
        {/* ... routes ... */}
      </BrowserRouter>
      <ToastContainer />
      <KeyboardShortcutsHelp />  {/* This displays the help modal */}
    </>
  )
}
```

### 5. Show Keyboard Shortcuts Hint in Footer

```typescript
// apps/web/src/components/layout/Layout.tsx
import { Keyboard } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'

function Layout() {
  const { openModal } = useUIStore()

  return (
    <div>
      {/* ... header and content ... */}

      <footer>
        <button
          onClick={() => openModal('keyboard-shortcuts')}
          aria-label="Show keyboard shortcuts"
        >
          <Keyboard className="h-3 w-3" />
          <span>
            Press <kbd>?</kbd> for keyboard shortcuts
          </span>
        </button>
      </footer>
    </div>
  )
}
```

## Advanced Examples

### Multi-Key Sequences

```typescript
useKeyboardShortcuts({
  shortcuts: [
    {
      key: 'f',
      description: 'Filter by severity',
      action: () => openFilterDialog(),
      category: 'Filtering',
      sequence: ['g', 'f'],  // Press G then F
      displayKey: 'G then F',
    },
  ],
})
```

### Platform-Specific Shortcuts

```typescript
const isMac = /Mac/.test(navigator.userAgent)

useKeyboardShortcuts({
  shortcuts: [
    {
      key: 's',
      description: 'Save',
      action: handleSave,
      category: 'Actions',
      modifiers: { ctrl: true, meta: true },  // Works with both Ctrl and Cmd
      displayKey: isMac ? '⌘S' : 'Ctrl+S',
    },
  ],
})
```

### Conditional Shortcuts

```typescript
function ServiceDetailPage() {
  const { service } = useService()
  const canEdit = usePermissions().canEdit('service')

  useKeyboardShortcuts({
    shortcuts: canEdit ? [
      {
        key: 'e',
        description: 'Edit service',
        action: () => navigate(`/services/${service.id}/edit`),
        category: 'Actions',
        displayKey: 'E',
      },
    ] : [],  // No shortcuts if user can't edit
  })
}
```

### Context-Aware Shortcuts

```typescript
function AlertsPage() {
  const location = useLocation()
  const [selectedAlerts, setSelectedAlerts] = useState([])

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'a',
        description: 'Acknowledge selected alerts',
        action: () => {
          if (selectedAlerts.length > 0) {
            acknowledgeAlerts(selectedAlerts)
          }
        },
        category: 'Actions',
        modifiers: { ctrl: true },
        displayKey: 'Ctrl+A',
      },
    ],
    enabled: location.pathname === '/alerts',  // Only on alerts page
  })
}
```

## Best Practices

### 1. Don't Override Browser Shortcuts

Avoid these commonly used browser shortcuts:
- `Ctrl/Cmd + T` (New tab)
- `Ctrl/Cmd + W` (Close tab)
- `Ctrl/Cmd + R` (Refresh)
- `Ctrl/Cmd + L` (Focus address bar)
- `F5` (Refresh)
- `Ctrl/Cmd + F` (Find in page)

### 2. Use Consistent Patterns

Follow these conventions:
- `G` + letter for navigation (G D = Dashboard, G I = Incidents)
- `Ctrl/Cmd` + letter for actions (Ctrl+S = Save)
- Single letters for quick actions (C = Create, E = Edit)
- `?` for help
- `/` for search
- `Esc` for closing modals

### 3. Provide Visual Feedback

Always show users what shortcuts are available:

```typescript
<Button
  onClick={handleCreate}
  tooltip="Create new incident"
  shortcut="C"
>
  <Plus className="h-4 w-4" />
  Create
</Button>
```

### 4. Group Related Shortcuts

Organize shortcuts by category in the help modal:

```typescript
{
  key: 'n',
  description: 'Create new',
  action: handleCreate,
  category: 'Actions',  // Will be grouped with other Actions
}
```

### 5. Test Shortcuts Don't Interfere with Input

The system automatically disables shortcuts when typing in inputs, but always test:

```typescript
// This is handled automatically - shortcuts won't fire when typing
<input type="text" placeholder="Search..." />
```

## Common Patterns

### Search Focus

```typescript
// Already implemented globally
// Press / to focus search
{
  key: '/',
  description: 'Focus search input',
  action: () => {
    const searchInput = document.querySelector('input[type="search"]')
    searchInput?.focus()
  },
  category: 'General',
}
```

### Modal Management

```typescript
// Already implemented globally
// Press Esc to close any modal
{
  key: 'Escape',
  description: 'Close modals',
  action: () => {
    const openModals = useUIStore.getState().modals
    Object.keys(openModals).forEach(id => closeModal(id))
  },
  category: 'General',
}
```

### Navigation

```typescript
// Use sequences to avoid conflicts
{
  key: 'i',
  description: 'Go to Incidents',
  action: () => navigate('/incidents'),
  category: 'Navigation',
  sequence: ['g', 'i'],
  displayKey: 'G then I',
}
```

## Accessibility Considerations

### ARIA Labels

```typescript
<button
  onClick={() => openModal('keyboard-shortcuts')}
  aria-label="Show keyboard shortcuts (press ? key)"
>
  Help
</button>
```

### Screen Reader Announcements

```typescript
<div role="status" aria-live="polite">
  {selectedCount > 0 && `${selectedCount} items selected. Press Ctrl+A to acknowledge.`}
</div>
```

### Keyboard Navigation

Ensure all interactive elements are keyboard accessible:

```typescript
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
>
  Clickable Item
</div>
```

## Debugging Shortcuts

### Check if Shortcuts are Enabled

```typescript
const { shortcuts } = useKeyboardShortcuts()

console.log('Active shortcuts:', shortcuts)
```

### Test Shortcut Conflicts

```typescript
// Log when shortcuts fire
useKeyboardShortcuts({
  shortcuts: [
    {
      key: 't',
      description: 'Test',
      action: () => console.log('Shortcut fired!'),
      category: 'Debug',
    },
  ],
})
```

### Verify Event Listeners

```javascript
// In browser console
getEventListeners(window).keydown
```

## Performance Tips

1. **Memoize shortcuts**: Don't recreate shortcuts array on every render
2. **Conditional registration**: Only register shortcuts when needed
3. **Cleanup**: Shortcuts automatically cleanup on unmount

```typescript
const shortcuts = useMemo(() => [
  {
    key: 'n',
    description: 'Create new',
    action: handleCreate,
    category: 'Actions',
  },
], [handleCreate])  // Only recreate when handleCreate changes

useKeyboardShortcuts({ shortcuts })
```
