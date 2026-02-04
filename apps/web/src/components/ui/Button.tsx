import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'
import { Tooltip } from '@/components/ui/Tooltip'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-900 disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary:
          'bg-accent-primary text-white hover:bg-accent-primary/90 focus:ring-accent-primary',
        secondary:
          'bg-dark-700 text-dark-100 hover:bg-dark-600 focus:ring-dark-500',
        outline:
          'border border-dark-600 text-dark-200 hover:bg-dark-800 focus:ring-dark-500',
        ghost: 'text-dark-200 hover:bg-dark-800 focus:ring-dark-500',
        danger:
          'bg-status-critical text-white hover:bg-status-critical/90 focus:ring-status-critical',
        success:
          'bg-status-success text-white hover:bg-status-success/90 focus:ring-status-success',
      },
      size: {
        sm: 'h-9 px-3 text-sm min-h-[36px]',
        md: 'h-11 px-4 text-sm min-h-[44px]',
        lg: 'h-12 px-6 text-base min-h-[48px]',
        icon: 'h-11 w-11 min-h-[44px] min-w-[44px]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean
  tooltip?: ReactNode
  shortcut?: string
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, tooltip, shortcut, ...props }, ref) => {
    const button = (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading...
          </>
        ) : (
          children
        )}
      </button>
    )

    if (tooltip) {
      return (
        <Tooltip content={tooltip} shortcut={shortcut}>
          {button}
        </Tooltip>
      )
    }

    return button
  }
)

Button.displayName = 'Button'

export { Button, buttonVariants }
