import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  AlertTriangle,
  Bell,
  Calendar,
  BarChart3,
  Settings,
  X,
  Server,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { usePermissions } from '@/hooks/usePermissions'
import { RoleBadge } from '@/components/ui/RoleBadge'
import { type Permission } from '@/lib/permissions/permissions'

interface NavItem {
  name: string
  href: string
  icon: typeof LayoutDashboard
  permission?: Permission
}

const navItems: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    name: 'Incidents',
    href: '/incidents',
    icon: AlertTriangle,
    permission: 'incidents.view',
  },
  {
    name: 'Alerts',
    href: '/alerts',
    icon: Bell,
    permission: 'alerts.view',
  },
  {
    name: 'Schedules',
    href: '/schedules',
    icon: Calendar,
    permission: 'schedules.view',
  },
  {
    name: 'Services',
    href: '/services',
    icon: Server,
    permission: 'services.view',
  },
  {
    name: 'Status Pages',
    href: '/status-pages',
    icon: BarChart3,
    permission: 'status_pages.view',
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    permission: 'settings.view',
  },
]

export function Sidebar() {
  const { sidebarOpen, setSidebarOpen, isMobile } = useUIStore()
  const { user } = useAuthStore()
  const { hasPermission } = usePermissions()

  // Filter navigation items based on permissions
  const visibleNavItems = navItems.filter((item) => {
    if (!item.permission) return true
    return hasPermission(item.permission)
  })

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
              {visibleNavItems.map((item) => (
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
              <div className="px-3 py-2 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-white font-medium text-sm">
                    {user?.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-dark-100 truncate">
                      {user?.name || 'User'}
                    </p>
                    <p className="text-xs text-dark-400 truncate">
                      {user?.email || 'user@example.com'}
                    </p>
                  </div>
                </div>
                {user?.role && (
                  <div className="flex justify-center">
                    <RoleBadge role={user.role} />
                  </div>
                )}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
