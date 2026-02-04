import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useUIStore } from '@/stores/uiStore'
import { Keyboard } from 'lucide-react'

export function Layout() {
  const { setIsMobile, openModal } = useUIStore()

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [setIsMobile])

  return (
    <div className="flex h-screen bg-dark-900 text-dark-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
        <footer className="border-t border-dark-800 bg-dark-900/50 backdrop-blur-sm">
          <div className="px-4 md:px-6 py-2">
            <button
              onClick={() => openModal('keyboard-shortcuts')}
              className="flex items-center gap-2 text-xs text-dark-400 hover:text-dark-200 transition-colors group"
              aria-label="Show keyboard shortcuts"
            >
              <Keyboard className="h-3 w-3 group-hover:text-accent-primary transition-colors" />
              <span>
                Press <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-dark-800 border border-dark-700 rounded ml-1">?</kbd> for keyboard shortcuts
              </span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
