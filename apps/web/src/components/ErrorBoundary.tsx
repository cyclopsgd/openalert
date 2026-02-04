import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { Button } from './ui/Button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    this.setState({
      errorInfo,
    })

    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // In production, you would send this to an error tracking service
    // Example: Sentry.captureException(error, { extra: errorInfo })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const isDevelopment = import.meta.env.DEV

      return (
        <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-8 shadow-2xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-full bg-red-500/10">
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
                <div>
                  <h1 className="text-2xl font-heading font-bold text-dark-50">
                    Something went wrong
                  </h1>
                  <p className="text-dark-400 mt-1">
                    We're sorry, but an unexpected error occurred
                  </p>
                </div>
              </div>

              {isDevelopment && this.state.error && (
                <div className="mb-6 p-4 bg-dark-900 border border-dark-700 rounded-lg">
                  <h2 className="text-sm font-semibold text-red-400 mb-2">Error Details:</h2>
                  <p className="text-sm text-dark-300 font-mono mb-3">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-dark-400 hover:text-dark-300 mb-2">
                        Component Stack Trace
                      </summary>
                      <pre className="text-dark-400 overflow-auto p-3 bg-dark-950 rounded">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={this.handleReload} className="flex-1">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reload Page
                </Button>
                <Button onClick={this.handleGoHome} variant="secondary" className="flex-1">
                  <Home className="h-4 w-4 mr-2" />
                  Go to Dashboard
                </Button>
              </div>

              <div className="mt-6 pt-6 border-t border-dark-700">
                <p className="text-sm text-dark-500">
                  If this problem persists, please contact support or check the console for more
                  details.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Hook for functional components to reset error boundary
export function useErrorBoundary() {
  const [, setState] = React.useState()
  return React.useCallback(() => {
    setState(() => {
      throw new Error('Manual error boundary reset')
    })
  }, [])
}
