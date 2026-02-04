import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function Modal({
  isOpen,
  onClose,
  children,
  title,
  size = 'md',
  className,
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  // Mobile optimization: full screen on small devices
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <div className={cn(
            "fixed inset-0 z-50 flex items-center justify-center",
            isMobile ? "p-0" : "p-4"
          )}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                'relative w-full bg-dark-800 border border-dark-700 shadow-xl overflow-y-auto',
                isMobile ? 'h-full rounded-none' : 'rounded-xl max-h-[90vh]',
                !isMobile && sizeClasses[size],
                className
              )}
            >
              {title && (
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-dark-700 sticky top-0 bg-dark-800 z-10">
                  <h2 className="text-lg sm:text-xl font-heading font-semibold text-dark-50 truncate pr-2">
                    {title}
                  </h2>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-dark-200 transition-colors flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Close modal"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
              <div className="p-4 sm:p-6">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
