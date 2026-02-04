import { useState } from 'react'
import { Menu, Moon, Sun, Bell, User, Settings, LogOut, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Dropdown, DropdownMenu, DropdownItem, DropdownDivider } from '@/components/ui/Dropdown'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { GlobalSearch, useGlobalSearchShortcut } from '@/components/GlobalSearch'

export function Header() {
  const navigate = useNavigate()
  const { theme, toggleTheme, toggleSidebar } = useUIStore()
  const { user, logout } = useAuthStore()
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Register keyboard shortcut (Cmd/Ctrl + K)
  useGlobalSearchShortcut(() => setIsSearchOpen(true))

  return (
    <>
      <header className="h-16 border-b border-dark-700 bg-dark-900/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="h-full px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-heading font-semibold text-dark-50">
              {/* Page title will be injected here */}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSearchOpen(true)}
              title="Search (Cmd/Ctrl + K)"
            >
              <Search className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>

            <Button variant="ghost" size="icon" title="Notifications">
              <Bell className="h-5 w-5" />
            </Button>

          <Dropdown
            trigger={
              <div className="ml-2 flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center">
                  <span className="text-xs font-semibold text-white">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
              </div>
            }
            align="right"
          >
            <DropdownMenu>
              <div className="px-4 py-3 border-b border-dark-700">
                <p className="text-sm font-medium text-dark-50">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-dark-400 mt-0.5">
                  {user?.email || ''}
                </p>
              </div>

              <DropdownItem
                icon={<User />}
                onClick={() => navigate('/profile')}
              >
                Profile
              </DropdownItem>

              <DropdownItem
                icon={<Settings />}
                onClick={() => navigate('/settings')}
              >
                Settings
              </DropdownItem>

              <DropdownDivider />

              <DropdownItem
                icon={<LogOut />}
                onClick={handleLogout}
                variant="danger"
              >
                Logout
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>
    </header>

    <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  )
}
