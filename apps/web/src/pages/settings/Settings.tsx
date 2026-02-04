import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, Users, Settings as SettingsIcon, Building2, Webhook, GitBranch, UsersRound, ArrowRight, Bell, BellRing } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const settingsNavItems = [
  {
    name: 'General',
    href: '/settings/general',
    icon: Building2,
    description: 'Organization and preferences',
  },
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
  {
    name: 'Teams',
    href: '/settings/teams',
    icon: UsersRound,
    description: 'Manage teams and members',
  },
  {
    name: 'Integrations',
    href: '/settings/integrations',
    icon: Webhook,
    description: 'Webhooks and external integrations',
  },
  {
    name: 'Escalation Policies',
    href: '/settings/escalation-policies',
    icon: ArrowRight,
    description: 'Define escalation paths',
  },
  {
    name: 'Notification Channels',
    href: '/settings/notifications',
    icon: Bell,
    description: 'Email, SMS, and webhook settings',
  },
  {
    name: 'Notification Preferences',
    href: '/settings/notification-preferences',
    icon: BellRing,
    description: 'Personal notification settings',
  },
  {
    name: 'Alert Routing',
    href: '/settings/alert-routing',
    icon: GitBranch,
    description: 'Configure routing rules',
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
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-dark-50 mb-2 flex items-center gap-2 sm:gap-3">
              <SettingsIcon className="h-6 w-6 sm:h-8 sm:w-8" />
              <span>Settings</span>
            </h1>
            <p className="text-sm sm:text-base text-dark-400">
              Manage your OpenAlert configuration and preferences
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {settingsNavItems.map((item, index) => (
              <NavLink key={item.href} to={item.href}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 sm:p-6 rounded-xl border border-dark-700 bg-dark-800 hover:bg-dark-750 hover:border-dark-600 transition-all cursor-pointer group touch-manipulation min-h-[80px]"
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 rounded-lg bg-accent-primary/10 text-accent-primary group-hover:bg-accent-primary group-hover:text-white transition-all flex-shrink-0">
                      <item.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading font-semibold text-sm sm:text-base text-dark-50 mb-1 break-words">
                        {item.name}
                      </h3>
                      <p className="text-xs sm:text-sm text-dark-400 break-words">{item.description}</p>
                    </div>
                  </div>
                </motion.div>
              </NavLink>
            ))}
          </div>
        </>
      )}

      {!isRootSettings && (
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="w-full lg:w-64 space-y-1">
            <p className="text-xs text-dark-500 mb-2 px-3 font-medium uppercase tracking-wider">
              Settings
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2">
              {settingsNavItems.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 sm:gap-3 px-3 py-3 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors touch-manipulation min-h-[44px]',
                      isActive
                        ? 'bg-accent-primary text-white'
                        : 'text-dark-300 hover:bg-dark-800 hover:text-dark-100'
                    )
                  }
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate leading-tight">{item.name}</span>
                </NavLink>
              ))}
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            <Outlet />
          </div>
        </div>
      )}
    </div>
  )
}
