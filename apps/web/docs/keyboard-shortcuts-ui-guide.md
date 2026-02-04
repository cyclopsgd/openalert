# Keyboard Shortcuts - UI Guide

This document provides a visual guide to the keyboard shortcuts UI elements in OpenAlert.

## UI Components

### 1. Footer Hint

**Location**: Bottom of every authenticated page

**Appearance**:
```
┌─────────────────────────────────────────────────────┐
│ [⌨]  Press ? for keyboard shortcuts                 │
└─────────────────────────────────────────────────────┘
```

**Features**:
- Always visible at the bottom of the layout
- Clickable to open help modal
- Keyboard icon for visual recognition
- Subtle styling that doesn't distract

**Code**:
```tsx
<button onClick={() => openModal('keyboard-shortcuts')}>
  <Keyboard className="h-3 w-3" />
  <span>Press <kbd>?</kbd> for keyboard shortcuts</span>
</button>
```

---

### 2. Keyboard Shortcuts Help Modal

**Trigger**: Press `?` key or click footer hint

**Layout**:
```
╔═══════════════════════════════════════════════╗
║  Keyboard Shortcuts                     [X]   ║
╠═══════════════════════════════════════════════╣
║                                               ║
║  [⌨] Use these keyboard shortcuts to         ║
║      navigate and perform actions quickly.   ║
║                                               ║
║  ┌─ General ─────────────────────────────┐   ║
║  │                                        │   ║
║  │  Open global search          [⌘K]     │   ║
║  │  Focus search input          [/]      │   ║
║  │  Show keyboard shortcuts     [?]      │   ║
║  │  Close modals/dialogs        [Esc]    │   ║
║  │                                        │   ║
║  └────────────────────────────────────────┘   ║
║                                               ║
║  ┌─ Navigation ───────────────────────────┐   ║
║  │                                        │   ║
║  │  Go to Dashboard      [G] then [D]    │   ║
║  │  Go to Incidents      [G] then [I]    │   ║
║  │  Go to Alerts         [G] then [A]    │   ║
║  │  Go to Services       [G] then [S]    │   ║
║  │  Go to Teams          [G] then [T]    │   ║
║  │                                        │   ║
║  └────────────────────────────────────────┘   ║
║                                               ║
║  ┌─ Actions ──────────────────────────────┐   ║
║  │                                        │   ║
║  │  Create new incident          [C]     │   ║
║  │                                        │   ║
║  └────────────────────────────────────────┘   ║
║                                               ║
║  ────────────────────────────────────────    ║
║                                               ║
║  Pro tip: Shortcuts work on most pages       ║
║  except when typing in input fields.          ║
║                                               ║
║  Mac users: ⌘ = Command, ⌥ = Option, ⇧ = Shift║
║                                               ║
╚═══════════════════════════════════════════════╝
```

**Features**:
- Organized by category
- Visual keyboard key badges
- Clear descriptions
- Platform-specific symbols
- Help text and pro tips
- Scrollable for many shortcuts

---

### 3. Button Tooltips

**Trigger**: Hover over buttons with shortcuts

**Appearance**:
```
┌──────────────────┐
│ Save changes     │
│           [⌘S]   │
└────────┬─────────┘
         │
    [   Save   ]
```

**Features**:
- Appears after 200ms hover delay
- Shows action description + keyboard shortcut
- Positioned above/below/left/right of button
- Auto-dismisses on mouse leave
- Keyboard badge styling

**Usage Example**:
```tsx
<Button
  onClick={handleSave}
  tooltip="Save changes"
  shortcut="Cmd+S"
>
  Save
</Button>
```

---

### 4. Keyboard Key Badge Styling

**Single Key**:
```
┌─────┐
│  ?  │
└─────┘
```

**Modifier + Key**:
```
┌──────┐   ┌─────┐
│ Ctrl │ + │  S  │
└──────┘   └─────┘
```

**Sequence Keys**:
```
┌─────┐       ┌─────┐
│  G  │  then │  D  │
└─────┘       └─────┘
```

**Mac Style**:
```
┌──────┐
│  ⌘K  │
└──────┘
```

**CSS Styling**:
- Background: Dark gray (`bg-dark-800`)
- Border: Subtle dark border (`border-dark-600`)
- Padding: Compact (`px-2 py-0.5`)
- Font: Monospace for keys
- Shadow: Subtle depth

---

## Visual Indicators

### 1. Active Shortcut Feedback

When a shortcut is triggered, there's no explicit visual feedback (shortcuts execute immediately), but users see the result:

**Navigation Shortcuts**:
- URL changes
- Page content updates
- Browser history updated

**Action Shortcuts**:
- Modal opens
- Form submits
- Item created/edited

**Search Shortcuts**:
- Input gains focus
- Cursor visible in search box
- Existing text selected

### 2. Modal Closure

When `Esc` is pressed:
- Modal fades out smoothly
- Backdrop disappears
- Focus returns to previous element

---

## Responsive Design

### Desktop (>1024px)

- Footer hint always visible
- Full help modal with all categories
- Tooltips show on all buttons
- Complete keyboard shortcuts available

### Tablet (768px - 1024px)

- Footer hint visible
- Help modal scrollable
- Tooltips still functional
- All shortcuts work

### Mobile (<768px)

- Footer hint may be hidden on very small screens
- Help modal takes full width
- Touch interfaces don't show tooltips
- Keyboard shortcuts not recommended for mobile

---

## Dark Mode Support

All keyboard shortcut UI elements support dark mode:

**Dark Mode (default)**:
- Background: `bg-dark-800`
- Text: `text-dark-100`
- Borders: `border-dark-700`
- Keys: `bg-dark-900`

**Light Mode** (if implemented):
- Background: `bg-gray-100`
- Text: `text-gray-900`
- Borders: `border-gray-300`
- Keys: `bg-white`

---

## Accessibility Features

### Visual

- High contrast key badges
- Clear text descriptions
- Icon indicators (keyboard icon)
- Hover states on interactive elements

### Screen Readers

- ARIA labels on all shortcuts
- `role="dialog"` on help modal
- `aria-live="polite"` on tooltips
- Descriptive button labels

### Keyboard Navigation

- Tab through all interactive elements
- Enter to activate buttons
- Escape to close modals
- Focus visible indicators

---

## Animation & Transitions

### Help Modal

**Open Animation**:
- Fade in backdrop (200ms)
- Scale up modal from 95% to 100%
- Slide up 20px
- Easing: `ease-out`

**Close Animation**:
- Fade out backdrop (200ms)
- Scale down modal to 95%
- Slide down 20px
- Easing: `ease-in`

### Tooltips

**Show**:
- Fade in (100ms)
- Scale from 95% to 100%
- Slight upward movement

**Hide**:
- Fade out (100ms)
- Scale to 95%
- Slight downward movement

### Footer Hint

**Hover**:
- Keyboard icon color changes to accent color
- Text color lightens
- Smooth transition (200ms)

---

## Color Scheme

### Keyboard Badges

```css
/* Key background */
background: #1a1d2e;  /* dark-800 */

/* Key border */
border: 1px solid #2d3348;  /* dark-600 */

/* Key text */
color: #e2e8f0;  /* dark-100 */

/* Shadow */
box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
```

### Categories

```css
/* Category icons */
General:    Command icon (#8b92ab)
Navigation: Navigation icon (#8b92ab)
Actions:    Zap icon (#8b92ab)

/* Category headers */
color: #e2e8f0;  /* dark-50 */
font-weight: 600;
```

### Help Modal

```css
/* Modal background */
background: #0f1219;  /* dark-900 */

/* Modal border */
border: 1px solid #2d3348;  /* dark-700 */

/* Backdrop */
background: rgba(0, 0, 0, 0.6);
backdrop-filter: blur(4px);
```

---

## Icon Usage

### Icons from Lucide React

```tsx
import {
  Keyboard,    // General shortcuts
  Command,     // Command/control shortcuts
  Navigation,  // Navigation shortcuts
  Zap,         // Action shortcuts
} from 'lucide-react'
```

**Sizing**:
- Footer hint: 12px (`h-3 w-3`)
- Category icons: 16px (`h-4 w-4`)
- Help modal title icon: 16px (`h-4 w-4`)

---

## Platform Differences

### macOS

**Symbols**:
- Command: `⌘`
- Option: `⌥`
- Shift: `⇧`
- Control: `⌃`

**Example**: `⌘K` instead of `Ctrl+K`

### Windows/Linux

**Text**:
- Control: `Ctrl`
- Alt: `Alt`
- Shift: `Shift`

**Example**: `Ctrl+K` with `+` separator

---

## Customization Points

Developers can customize:

1. **Colors**: Via Tailwind theme
2. **Animation timing**: In framer-motion props
3. **Tooltip delay**: In Tooltip component
4. **Key badge styling**: In KeyboardShortcutsHelp
5. **Category icons**: In categoryIcons object
6. **Help text**: In KeyboardShortcutsHelp component

---

## Testing Visual Elements

### Manual Testing Checklist

- [ ] Press `?` to open help modal
- [ ] Modal displays all shortcuts
- [ ] Categories are properly grouped
- [ ] Keyboard badges render correctly
- [ ] Click X to close modal
- [ ] Press Esc to close modal
- [ ] Footer hint is visible
- [ ] Click footer hint opens modal
- [ ] Hover button shows tooltip
- [ ] Tooltip displays shortcut
- [ ] Platform-specific keys show correctly
- [ ] Dark mode colors are correct
- [ ] Animations are smooth
- [ ] Responsive on mobile

---

## Screenshots

### Desktop View

The help modal centered on screen with:
- Title bar with close button
- Scrollable content area
- Grouped shortcuts by category
- Footer with tips

### Mobile View

The help modal taking full width with:
- Compact layout
- Touch-friendly close button
- Scrollable categories
- Simplified footer

---

## Best Practices for UI

1. **Consistency**: Use same styling for all keyboard badges
2. **Clarity**: Clear descriptions, no jargon
3. **Visibility**: Footer hint always visible
4. **Accessibility**: High contrast, screen reader support
5. **Performance**: Smooth animations, no jank
6. **Responsive**: Works on all screen sizes
7. **Discoverable**: Obvious how to access help

---

## Future UI Enhancements

Potential improvements:

- [ ] Animated sequence demonstration
- [ ] Visual keyboard diagram
- [ ] Customization UI for user preferences
- [ ] Quick reference card (printable)
- [ ] Search within shortcuts
- [ ] Filter shortcuts by category
- [ ] Favorite/pin shortcuts
- [ ] Shortcut conflict warnings
