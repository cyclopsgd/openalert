import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          type={type}
          className={cn(
            'flex h-11 min-h-[44px] w-full rounded-lg border border-dark-600 bg-dark-800 px-3 py-2 text-base sm:text-sm text-dark-100 placeholder:text-dark-400 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all touch-manipulation',
            error && 'border-status-critical focus:ring-status-critical',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-status-critical">{error}</p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
