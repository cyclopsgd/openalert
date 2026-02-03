import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  AlertTriangle,
  Bell,
  Calendar,
  BarChart3,
  Settings,
  X,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { useUIStore } from '@/stores/uiStore'

const navItems = [
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    name: 'Incidents',
    href: '/incidents',
    icon: AlertTriangle,
  },
  {
    name: 'Alerts',
    href: '/alerts',
    icon: Bell,
  },
  {
    name: 'Schedules',
    href: '/schedules',
    icon: Calendar,
  },
  {
    name: 'Status Pages',
    href: '/status-pages',
    icon: BarChart3,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
]

export function Sidebar() {
  const { sidebarOpen, setSidebarOpen, isMobile } = useUIStore()

  const handleClose = () => {
    if (isMobile) {
      setSidebarOpen(false)
    }
  }

  return (
    <>
      {isMobile && sidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        />
      )}

      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={isMobile ? { x: -280 } : false}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
              'h-screen bg-dark-900 border-r border-dark-700 flex flex-col',
              isMobile ? 'fixed left-0 top-0 z-50 w-72' : 'w-64'
            )}
          >
            <div className="p-6 border-b border-dark-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-xl font-heading font-bold text-dark-50">
                  OpenAlert
                </h1>
              </div>
              {isMobile && (
                <button
                  onClick={handleClose}
                  className="p-1 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-dark-200 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={handleClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-accent-primary text-white'
                        : 'text-dark-300 hover:bg-dark-800 hover:text-dark-100'
                    )
                  }
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </NavLink>
              ))}
            </nav>

            <div className="p-4 border-t border-dark-700">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dark-100 truncate">
                    User
                  </p>
                  <p className="text-xs text-dark-400 truncate">
                    user@example.com
                  </p>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
