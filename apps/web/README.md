# OpenAlert Web Frontend

Enterprise-grade incident management UI built with React, TypeScript, and TailwindCSS.

## Tech Stack

- **React 18.3** - Modern React with hooks and concurrent features
- **TypeScript** - Type-safe development with strict mode
- **Vite** - Fast build tooling and dev server
- **Zustand** - Lightweight state management
- **React Query** - Server state management and caching
- **React Router** - Client-side routing with protected routes
- **Socket.IO Client** - Real-time WebSocket updates
- **TailwindCSS 3** - Utility-first CSS framework
- **Framer Motion** - Smooth animations and transitions
- **Lucide React** - Beautiful icon library

## Features

### Core Functionality
- ✅ **Dashboard** - Real-time metrics and active incidents overview
- ✅ **Incidents** - Browse, filter, and manage incidents
- ✅ **Incident Details** - Timeline, alerts, and action buttons
- ✅ **Alerts** - View and manage all alerts
- ✅ **Authentication** - Azure AD SSO with JWT tokens
- ✅ **Real-time Updates** - WebSocket integration for live data

### UI/UX
- 🎨 Dark-first design with refined technical aesthetic
- 📱 Fully responsive (mobile, tablet, desktop)
- ⚡ Smooth animations with Framer Motion
- 🎯 Type-safe API integration
- 🔒 Protected routes with authentication guards
- 🌙 Theme toggle (dark/light mode)

## Quick Start

### Prerequisites
- Node.js 20+
- npm or yarn
- Backend API running on http://localhost:3001

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variables

Create a `.env` file:

```env
VITE_API_URL=http://localhost:3001
```

## Project Structure

```
apps/web/
├── src/
│   ├── components/          # UI components
│   │   ├── ui/             # Reusable UI components
│   │   ├── layout/         # Layout components
│   │   ├── dashboard/      # Dashboard-specific components
│   │   └── incidents/      # Incident-specific components
│   ├── pages/              # Route pages
│   ├── stores/             # Zustand stores
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities and helpers
│   │   ├── api/           # API client
│   │   ├── socket/        # WebSocket client
│   │   └── utils/         # Utility functions
│   └── types/              # TypeScript types
├── public/                 # Static assets
└── index.html             # Entry HTML
```

## Key Files

### State Management (Zustand Stores)
- `stores/authStore.ts` - Authentication state
- `stores/incidentsStore.ts` - Incidents state and filtering
- `stores/alertsStore.ts` - Alerts state and filtering
- `stores/uiStore.ts` - UI state (theme, sidebar, modals)

### Custom Hooks
- `hooks/useIncidents.ts` - Incident data fetching and mutations
- `hooks/useAlerts.ts` - Alert data fetching and mutations
- `hooks/useMetrics.ts` - Dashboard metrics
- `hooks/useRealtime.ts` - WebSocket real-time updates

### API Integration
- `lib/api/client.ts` - Axios client with interceptors
- `lib/socket/client.ts` - Socket.IO client wrapper

## Design System

### Colors
```css
/* Dark theme colors */
dark-900: #0a0e17  /* Primary background */
dark-800: #111827  /* Secondary background */
dark-700: #1f2937  /* Borders */
dark-600: #374151  /* Hover states */

/* Status colors */
status-critical: #ef4444  /* Critical severity */
status-warning: #f59e0b   /* Warnings */
status-success: #10b981   /* Success states */

/* Accent colors */
accent-primary: #6366f1    /* Primary actions */
accent-secondary: #8b5cf6  /* Secondary accents */
accent-tertiary: #06b6d4   /* Tertiary accents */
```

### Typography
- **Sans**: DM Sans, Inter - Body text
- **Heading**: Outfit - Headings and titles
- **Mono**: JetBrains Mono - Code and numbers

## Development Guide

### Adding a New Page

1. Create page component in `src/pages/`:
```tsx
// src/pages/NewPage.tsx
export function NewPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-heading font-bold text-dark-50">
        New Page
      </h1>
      {/* Page content */}
    </div>
  )
}
```

2. Add route in `src/App.tsx`:
```tsx
<Route path="/new-page" element={<NewPage />} />
```

3. Add navigation in `src/components/layout/Sidebar.tsx`.

### Adding a New API Endpoint

1. Add types in `src/types/api.ts`:
```tsx
export interface NewResource {
  id: number
  name: string
  // ...
}
```

2. Create custom hook in `src/hooks/`:
```tsx
export function useNewResource() {
  return useQuery({
    queryKey: ['newResource'],
    queryFn: async () => {
      const response = await apiClient.get<NewResource[]>('/new-resource')
      return response.data
    },
  })
}
```

### Creating a New Component

Use the existing component patterns:
```tsx
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/Card'

export function MyComponent({ data }: MyComponentProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="p-4">
        {/* Component content */}
      </Card>
    </motion.div>
  )
}
```

## Real-time Updates

The app uses Socket.IO for real-time updates. WebSocket connection is automatically established on login.

```tsx
// Subscribe to updates in a component
import { useRealtime } from '@/hooks/useRealtime'

function MyComponent() {
  useRealtime() // Automatically connects and subscribes

  // ... component logic
}
```

## Testing the Frontend

### With Backend Running

1. Start the backend API (http://localhost:3001)
2. Start the frontend dev server (http://localhost:5173)
3. Get a dev token from http://localhost:3001/auth/dev-token/1
4. Visit http://localhost:5173/login?token=YOUR_TOKEN

### Development Login

Since Azure AD might not be configured:
1. Visit http://localhost:3001/auth/dev-token/1
2. Copy the `accessToken`
3. In browser console: `localStorage.setItem('authToken', 'YOUR_TOKEN')`
4. Refresh the page

## Build and Deployment

### Build for Production

```bash
npm run build
```

Output will be in `dist/` directory.

### Deployment Options

The frontend is a static SPA that can be deployed to:
- Vercel
- Netlify
- AWS S3 + CloudFront
- Azure Static Web Apps
- Any static hosting service

### Environment Variables for Production

```env
VITE_API_URL=https://api.yourdomain.com
```

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)

## Performance

- Code splitting by route
- React Query caching (30s stale time)
- Optimistic UI updates
- Lazy loading for heavy components
- Tree-shaking with Vite

## Accessibility

- Semantic HTML
- ARIA labels where appropriate
- Keyboard navigation support
- Focus management
- Color contrast (WCAG AA)

## Contributing

1. Follow the existing code style
2. Use TypeScript strict mode
3. Add types for all new features
4. Test on mobile and desktop
5. Ensure dark mode compatibility

## Troubleshooting

### Cannot connect to backend
- Check that backend is running on http://localhost:3001
- Check CORS configuration in backend
- Verify VITE_API_URL environment variable

### WebSocket not connecting
- Ensure Socket.IO is configured in backend
- Check browser console for connection errors
- Verify authentication token is valid

### Build errors
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Clear Vite cache: `rm -rf node_modules/.vite`
- Check for TypeScript errors: `npm run build`

## License

MIT
