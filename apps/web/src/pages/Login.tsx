import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { apiClient } from '@/lib/api/client'
import { useAuthStore } from '@/stores/authStore'

export function Login() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [name, setName] = useState('')

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await apiClient.post('/auth/login/local', {
        email,
        password,
      })

      await login(response.data.accessToken)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await apiClient.post('/auth/register', {
        email,
        password,
        name,
      })

      await login(response.data.accessToken)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-accent-primary to-accent-secondary mb-4">
            <AlertTriangle className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-heading font-bold text-dark-50 mb-2">
            OpenAlert
          </h1>
          <p className="text-dark-400">
            Sign in to manage your incidents
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{showRegister ? 'Create Account' : 'Welcome Back'}</CardTitle>
            <CardDescription>
              {showRegister
                ? 'Register a new account to get started'
                : 'Sign in to your account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-status-critical/10 border border-status-critical/30 rounded-lg">
                <p className="text-sm text-status-critical">{error}</p>
              </div>
            )}

            <form onSubmit={showRegister ? handleRegister : handleLocalLogin} className="space-y-4">
              {showRegister && (
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Full Name
                  </label>
                  <Input
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Password
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
                {showRegister && (
                  <p className="mt-1 text-xs text-dark-500">
                    Minimum 8 characters
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                isLoading={loading}
              >
                {showRegister ? 'Create Account' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setShowRegister(!showRegister)
                  setError('')
                }}
                className="text-sm text-accent-primary hover:text-accent-primary/80 transition-colors"
              >
                {showRegister
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Register"}
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-dark-700">
              <p className="text-xs text-dark-500 text-center mb-3">
                Or continue with
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  window.location.href = 'http://localhost:3001/auth/login'
                }}
              >
                Sign in with Microsoft
              </Button>
            </div>

            <p className="text-xs text-dark-500 text-center mt-4">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
