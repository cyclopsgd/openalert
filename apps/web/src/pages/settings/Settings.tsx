import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, Users, Settings as SettingsIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const settingsNavItems = [
  {
    name: 'SSO Configuration',
    href: '/settings/sso',
    icon: Shield,
    description: 'Configure Azure AD / Entra ID',
  },
  {
    name: 'User Management',
    href: '/settings/users',
    icon: Users,
    description: 'Manage users and permissions',
  },
]

export function Settings() {
  const location = useLocation()
  const isRootSettings = location.pathname === '/settings'

  return (
    <div className="space-y-6">
      {isRootSettings && (
        <>
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-heading font-bold text-dark-50 mb-2 flex items-center gap-3">
              <SettingsIcon className="h-8 w-8" />
              Settings
            </h1>
            <p className="text-dark-400">
              Manage your OpenAlert configuration and preferences
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settingsNavItems.map((item, index) => (
              <NavLink key={item.href} to={item.href}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-6 rounded-xl border border-dark-700 bg-dark-800 hover:bg-dark-750 hover:border-dark-600 transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-accent-primary/10 text-accent-primary group-hover:bg-accent-primary group-hover:text-white transition-all">
                      <item.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-heading font-semibold text-dark-50 mb-1">
                        {item.name}
                      </h3>
                      <p className="text-sm text-dark-400">{item.description}</p>
                    </div>
                  </div>
                </motion.div>
              </NavLink>
            ))}
          </div>
        </>
      )}

      {!isRootSettings && (
        <div className="flex gap-6">
          <aside className="w-64 space-y-1">
            <p className="text-xs text-dark-500 mb-2 px-3 font-medium uppercase tracking-wider">
              Settings
            </p>
            {settingsNavItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent-primary text-white'
                      : 'text-dark-300 hover:bg-dark-800 hover:text-dark-100'
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                <span>{item.name}</span>
              </NavLink>
            ))}
          </aside>

          <div className="flex-1">
            <Outlet />
          </div>
        </div>
      )}
    </div>
  )
}
