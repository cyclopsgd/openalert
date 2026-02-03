import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, MessageSquare, Webhook, Check, X, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { apiClient } from '@/lib/api/client'

interface NotificationConfig {
  email?: {
    enabled: boolean
    smtpHost?: string
    smtpPort?: number
    smtpUsername?: string
    smtpPassword?: string
    fromAddress?: string
  }
  sms?: {
    enabled: boolean
    twilioAccountSid?: string
    twilioAuthToken?: string
    twilioPhoneNumber?: string
  }
  webhook?: {
    enabled: boolean
    url?: string
    secretToken?: string
    headers?: Record<string, string>
    events?: string[]
  }
}

export function NotificationSettings() {
  const queryClient = useQueryClient()
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)
  const [showTwilioToken, setShowTwilioToken] = useState(false)
  const [showWebhookSecret, setShowWebhookSecret] = useState(false)

  const { data: config, isLoading } = useQuery<NotificationConfig>({
    queryKey: ['notification-config'],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/system-settings/notification-config')
        return response.data
      } catch {
        return { email: { enabled: false }, sms: { enabled: false }, webhook: { enabled: false } }
      }
    },
  })

  const [emailConfig, setEmailConfig] = useState({
    enabled: false,
    smtpHost: '',
    smtpPort: 587,
    smtpUsername: '',
    smtpPassword: '',
    fromAddress: '',
  })

  const [smsConfig, setSmsConfig] = useState({
    enabled: false,
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioPhoneNumber: '',
  })

  const [webhookConfig, setWebhookConfig] = useState({
    enabled: false,
    url: '',
    secretToken: '',
    headers: {} as Record<string, string>,
    events: ['incident.triggered', 'incident.acknowledged', 'incident.resolved'],
  })

  const [headerKey, setHeaderKey] = useState('')
  const [headerValue, setHeaderValue] = useState('')

  const saveMutation = useMutation({
    mutationFn: async (data: NotificationConfig) => {
      await apiClient.post('/system-settings/notification-config', data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-config'] })
      alert('Settings saved successfully')
    },
  })

  const testEmailMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/notifications/test/email', emailConfig)
    },
    onSuccess: () => {
      alert('Test email sent successfully')
    },
    onError: () => {
      alert('Failed to send test email')
    },
  })

  const testSmsMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/notifications/test/sms', smsConfig)
    },
    onSuccess: () => {
      alert('Test SMS sent successfully')
    },
    onError: () => {
      alert('Failed to send test SMS')
    },
  })

  const testWebhookMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/notifications/test/webhook', webhookConfig)
    },
    onSuccess: () => {
      alert('Test webhook sent successfully')
    },
    onError: () => {
      alert('Failed to send test webhook')
    },
  })

  const handleSave = () => {
    saveMutation.mutate({
      email: emailConfig,
      sms: smsConfig,
      webhook: webhookConfig,
    })
  }

  const addHeader = () => {
    if (headerKey && headerValue) {
      setWebhookConfig({
        ...webhookConfig,
        headers: {
          ...webhookConfig.headers,
          [headerKey]: headerValue,
        },
      })
      setHeaderKey('')
      setHeaderValue('')
    }
  }

  const removeHeader = (key: string) => {
    const { [key]: _, ...rest } = webhookConfig.headers
    setWebhookConfig({ ...webhookConfig, headers: rest })
  }

  const toggleEvent = (event: string) => {
    if (webhookConfig.events.includes(event)) {
      setWebhookConfig({
        ...webhookConfig,
        events: webhookConfig.events.filter((e) => e !== event),
      })
    } else {
      setWebhookConfig({
        ...webhookConfig,
        events: [...webhookConfig.events, event],
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-accent-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-dark-50">
          Notification Channels
        </h1>
        <p className="text-dark-400 mt-1">
          Configure email, SMS, and webhook notifications
        </p>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-accent-primary/10 flex items-center justify-center">
              <Mail className="h-5 w-5 text-accent-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-dark-50">Email (SMTP)</h2>
              <p className="text-sm text-dark-400">Send notifications via email</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={emailConfig.enabled}
              onChange={(e) =>
                setEmailConfig({ ...emailConfig, enabled: e.target.checked })
              }
            />
            <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-primary"></div>
          </label>
        </div>

        {emailConfig.enabled && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  SMTP Host
                </label>
                <Input
                  value={emailConfig.smtpHost}
                  onChange={(e) =>
                    setEmailConfig({ ...emailConfig, smtpHost: e.target.value })
                  }
                  placeholder="smtp.example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  SMTP Port
                </label>
                <Input
                  type="number"
                  value={emailConfig.smtpPort}
                  onChange={(e) =>
                    setEmailConfig({ ...emailConfig, smtpPort: Number(e.target.value) })
                  }
                  placeholder="587"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Username
                </label>
                <Input
                  value={emailConfig.smtpUsername}
                  onChange={(e) =>
                    setEmailConfig({ ...emailConfig, smtpUsername: e.target.value })
                  }
                  placeholder="smtp-username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Input
                    type={showSmtpPassword ? 'text' : 'password'}
                    value={emailConfig.smtpPassword}
                    onChange={(e) =>
                      setEmailConfig({ ...emailConfig, smtpPassword: e.target.value })
                    }
                    placeholder="••••••••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200"
                  >
                    {showSmtpPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  From Address
                </label>
                <Input
                  type="email"
                  value={emailConfig.fromAddress}
                  onChange={(e) =>
                    setEmailConfig({ ...emailConfig, fromAddress: e.target.value })
                  }
                  placeholder="alerts@example.com"
                />
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => testEmailMutation.mutate()}
              disabled={testEmailMutation.isPending}
            >
              {testEmailMutation.isPending ? 'Sending...' : 'Send Test Email'}
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-accent-primary/10 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-accent-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-dark-50">SMS (Twilio)</h2>
              <p className="text-sm text-dark-400">Send notifications via SMS</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={smsConfig.enabled}
              onChange={(e) =>
                setSmsConfig({ ...smsConfig, enabled: e.target.checked })
              }
            />
            <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-primary"></div>
          </label>
        </div>

        {smsConfig.enabled && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Twilio Account SID
                </label>
                <Input
                  value={smsConfig.twilioAccountSid}
                  onChange={(e) =>
                    setSmsConfig({ ...smsConfig, twilioAccountSid: e.target.value })
                  }
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Auth Token
                </label>
                <div className="relative">
                  <Input
                    type={showTwilioToken ? 'text' : 'password'}
                    value={smsConfig.twilioAuthToken}
                    onChange={(e) =>
                      setSmsConfig({ ...smsConfig, twilioAuthToken: e.target.value })
                    }
                    placeholder="••••••••••••••••••••••••••••••••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTwilioToken(!showTwilioToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200"
                  >
                    {showTwilioToken ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Phone Number
                </label>
                <Input
                  value={smsConfig.twilioPhoneNumber}
                  onChange={(e) =>
                    setSmsConfig({ ...smsConfig, twilioPhoneNumber: e.target.value })
                  }
                  placeholder="+1234567890"
                />
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => testSmsMutation.mutate()}
              disabled={testSmsMutation.isPending}
            >
              {testSmsMutation.isPending ? 'Sending...' : 'Send Test SMS'}
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-accent-primary/10 flex items-center justify-center">
              <Webhook className="h-5 w-5 text-accent-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-dark-50">Webhooks</h2>
              <p className="text-sm text-dark-400">
                Send incident events to external systems
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={webhookConfig.enabled}
              onChange={(e) =>
                setWebhookConfig({ ...webhookConfig, enabled: e.target.checked })
              }
            />
            <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-primary"></div>
          </label>
        </div>

        {webhookConfig.enabled && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Webhook URL
              </label>
              <Input
                value={webhookConfig.url}
                onChange={(e) =>
                  setWebhookConfig({ ...webhookConfig, url: e.target.value })
                }
                placeholder="https://example.com/webhook"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Secret Token
              </label>
              <div className="relative">
                <Input
                  type={showWebhookSecret ? 'text' : 'password'}
                  value={webhookConfig.secretToken}
                  onChange={(e) =>
                    setWebhookConfig({ ...webhookConfig, secretToken: e.target.value })
                  }
                  placeholder="••••••••••••••••••••••••••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200"
                >
                  {showWebhookSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-dark-500 mt-1">
                Used for webhook signature verification
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Custom Headers
              </label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={headerKey}
                  onChange={(e) => setHeaderKey(e.target.value)}
                  placeholder="Header name"
                  className="flex-1"
                />
                <Input
                  value={headerValue}
                  onChange={(e) => setHeaderValue(e.target.value)}
                  placeholder="Header value"
                  className="flex-1"
                />
                <Button type="button" onClick={addHeader} size="sm">
                  Add
                </Button>
              </div>

              {Object.entries(webhookConfig.headers).length > 0 && (
                <div className="space-y-2">
                  {Object.entries(webhookConfig.headers).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-dark-800 border border-dark-700"
                    >
                      <span className="text-sm text-dark-200">
                        {key}: {value}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeHeader(key)}
                        className="text-dark-500 hover:text-dark-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Event Types
              </label>
              <div className="space-y-2">
                {[
                  { id: 'incident.triggered', label: 'Incident Triggered' },
                  { id: 'incident.acknowledged', label: 'Incident Acknowledged' },
                  { id: 'incident.resolved', label: 'Incident Resolved' },
                  { id: 'incident.escalated', label: 'Incident Escalated' },
                ].map((event) => (
                  <label
                    key={event.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-dark-800 border border-dark-700 cursor-pointer hover:bg-dark-750"
                  >
                    <input
                      type="checkbox"
                      checked={webhookConfig.events.includes(event.id)}
                      onChange={() => toggleEvent(event.id)}
                      className="rounded border-dark-600 text-accent-primary focus:ring-accent-primary"
                    />
                    <span className="text-sm text-dark-200">{event.label}</span>
                    {webhookConfig.events.includes(event.id) && (
                      <Check className="h-4 w-4 ml-auto text-accent-primary" />
                    )}
                  </label>
                ))}
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => testWebhookMutation.mutate()}
              disabled={testWebhookMutation.isPending}
            >
              {testWebhookMutation.isPending ? 'Sending...' : 'Test Webhook'}
            </Button>
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          size="lg"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save All Settings'}
        </Button>
      </div>
    </div>
  )
}
