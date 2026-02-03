import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Save, Shield, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { apiClient } from '@/lib/api/client'

interface SSOConfig {
  tenantId: string | null
  clientId: string | null
  clientSecret: string | null
  ssoEnabled: boolean
  registrationEnabled: boolean
}

interface FormData {
  tenantId: string
  clientId: string
  clientSecret: string
  ssoEnabled: boolean
  registrationEnabled: boolean
}

export function SSOSettings() {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState<FormData>({
    tenantId: '',
    clientId: '',
    clientSecret: '',
    ssoEnabled: false,
    registrationEnabled: true,
  })
  const [hasChanges, setHasChanges] = useState(false)

  const { data: config, isLoading, error } = useQuery({
    queryKey: ['sso-config'],
    queryFn: async () => {
      const response = await apiClient.get<SSOConfig>('/system-settings/sso')
      return response.data
    },
  })

  // Update form when data is loaded
  if (config && !hasChanges) {
    const newFormData = {
      tenantId: config.tenantId || '',
      clientId: config.clientId || '',
      clientSecret: config.clientSecret || '',
      ssoEnabled: config.ssoEnabled,
      registrationEnabled: config.registrationEnabled,
    }
    if (JSON.stringify(newFormData) !== JSON.stringify(formData)) {
      setFormData(newFormData)
    }
  }

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<SSOConfig>) => {
      const response = await apiClient.put('/system-settings/sso', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-config'] })
      setHasChanges(false)
    },
  })

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  const handleSave = () => {
    updateMutation.mutate(formData)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-accent-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-status-critical mx-auto mb-4" />
        <p className="text-status-critical mb-4">Failed to load SSO configuration</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['sso-config'] })}>
          Retry
        </Button>
      </div>
    )
  }

  const isSSOConfigured = config?.tenantId && config?.clientId && config?.clientSecret

  return (
    <div className="space-y-6 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-heading font-bold text-dark-50 mb-2">
          SSO Configuration
        </h1>
        <p className="text-dark-400">
          Configure Azure AD / Entra ID single sign-on settings
        </p>
      </motion.div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Azure AD / Entra ID
              </CardTitle>
              <CardDescription>
                Configure your Azure Active Directory settings
              </CardDescription>
            </div>
            {isSSOConfigured && (
              <div className="flex items-center gap-2 text-status-success text-sm">
                <CheckCircle2 className="h-4 w-4" />
                Configured
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-dark-300 mb-2 block">
              Tenant ID
            </label>
            <Input
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={formData.tenantId}
              onChange={(e) => handleInputChange('tenantId', e.target.value)}
            />
            <p className="mt-1 text-xs text-dark-500">
              Your Azure AD tenant ID (found in Azure Portal)
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-dark-300 mb-2 block">
              Client ID (Application ID)
            </label>
            <Input
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={formData.clientId}
              onChange={(e) => handleInputChange('clientId', e.target.value)}
            />
            <p className="mt-1 text-xs text-dark-500">
              Your application's client ID from App Registration
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-dark-300 mb-2 block">
              Client Secret
            </label>
            <Input
              type="password"
              placeholder={formData.clientSecret === '********' ? '********' : 'Enter client secret'}
              value={formData.clientSecret}
              onChange={(e) => handleInputChange('clientSecret', e.target.value)}
            />
            <p className="mt-1 text-xs text-dark-500">
              Your application's client secret (will be stored encrypted)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SSO Settings</CardTitle>
          <CardDescription>Control how SSO is enforced in your organization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-dark-900 rounded-lg">
            <div>
              <p className="font-medium text-dark-100">Enforce SSO</p>
              <p className="text-sm text-dark-400">
                When enabled, only SSO authentication is allowed (local auth disabled)
              </p>
            </div>
            <button
              onClick={() => handleInputChange('ssoEnabled', !formData.ssoEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.ssoEnabled ? 'bg-accent-primary' : 'bg-dark-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.ssoEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-dark-900 rounded-lg">
            <div>
              <p className="font-medium text-dark-100">Allow User Registration</p>
              <p className="text-sm text-dark-400">
                When enabled, new users can register with local credentials
              </p>
            </div>
            <button
              onClick={() =>
                handleInputChange('registrationEnabled', !formData.registrationEnabled)
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.registrationEnabled ? 'bg-accent-primary' : 'bg-dark-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.registrationEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {formData.ssoEnabled && !isSSOConfigured && (
            <div className="p-4 bg-status-warning/10 border border-status-warning/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-status-warning mt-0.5" />
              <div>
                <p className="font-medium text-status-warning">Warning</p>
                <p className="text-sm text-dark-300">
                  SSO is enabled but not fully configured. Users may not be able to log in
                  until you provide valid Azure AD credentials.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-dark-400">
          {hasChanges
            ? 'You have unsaved changes'
            : updateMutation.isSuccess
            ? 'Settings saved successfully'
            : ''}
        </p>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || updateMutation.isPending}
          isLoading={updateMutation.isPending}
        >
          <Save className="h-4 w-4" />
          Save Configuration
        </Button>
      </div>

      {updateMutation.isError && (
        <div className="p-4 bg-status-critical/10 border border-status-critical/30 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-status-critical mt-0.5" />
          <div>
            <p className="font-medium text-status-critical">Error</p>
            <p className="text-sm text-dark-300">
              {(updateMutation.error as Error & { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'Failed to save configuration'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
