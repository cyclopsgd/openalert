import { useState } from 'react'
import type { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  shortcut?: string
  className?: string
  delay?: number
}

export function Tooltip({
  content,
  children,
  position = 'top',
  shortcut,
  className,
  delay = 200,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)

  const handleMouseEnter = () => {
    const id = setTimeout(() => {
      setIsVisible(true)
    }, delay)
    setTimeoutId(id)
  }

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    setIsVisible(false)
  }

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent',
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className={cn(
              'absolute z-50 pointer-events-none',
              positionClasses[position]
            )}
            role="tooltip"
            aria-live="polite"
          >
            <div
              className={cn(
                'px-3 py-2 text-xs font-medium text-dark-100 bg-dark-800 border border-dark-700 rounded-lg shadow-xl whitespace-nowrap',
                className
              )}
            >
              <div className="flex items-center gap-2">
                <span>{content}</span>
                {shortcut && (
                  <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-dark-900 border border-dark-600 rounded">
                    {shortcut}
                  </kbd>
                )}
              </div>
              <div
                className={cn(
                  'absolute w-0 h-0 border-4 border-dark-800',
                  arrowClasses[position]
                )}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
