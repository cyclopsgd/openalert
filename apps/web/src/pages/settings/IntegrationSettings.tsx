import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Webhook, Plus, Trash2, RefreshCw, Copy, Check, ExternalLink, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { apiClient } from '@/lib/api/client'

interface Integration {
  id: number
  name: string
  type: string
  integrationKey: string
  isActive: boolean
  createdAt: string
  serviceId: number
}

interface WebhookLog {
  id: number
  method: string
  path: string
  statusCode: number
  userAgent: string
  createdAt: string
  error?: string
}

const integrationTypes = [
  { value: 'prometheus', label: 'Prometheus Alertmanager', icon: '🔥' },
  { value: 'grafana', label: 'Grafana', icon: '📊' },
  { value: 'azure_monitor', label: 'Azure Monitor', icon: '☁️' },
  { value: 'datadog', label: 'Datadog', icon: '🐶' },
  { value: 'webhook', label: 'Custom Webhook', icon: '🔗' },
]

export function IntegrationSettings() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null)
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [newIntegration, setNewIntegration] = useState({
    name: '',
    type: 'webhook',
    serviceId: 1,
  })

  useEffect(() => {
    fetchIntegrations()
  }, [])

  const fetchIntegrations = async () => {
    try {
      const response = await apiClient.get('/integrations')
      setIntegrations(response.data)
    } catch (error) {
      console.error('Failed to fetch integrations:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchWebhookLogs = async (integrationId: number) => {
    try {
      const response = await apiClient.get(`/integrations/${integrationId}/webhook-logs`)
      setWebhookLogs(response.data)
    } catch (error) {
      console.error('Failed to fetch webhook logs:', error)
    }
  }

  const handleCreate = async () => {
    try {
      const response = await apiClient.post('/integrations', newIntegration)
      setIntegrations([...integrations, response.data])
      setShowCreateModal(false)
      setNewIntegration({ name: '', type: 'webhook', serviceId: 1 })
    } catch (error) {
      console.error('Failed to create integration:', error)
      alert('Failed to create integration. Please check console for details.')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this integration?')) return

    try {
      await apiClient.delete(`/integrations/${id}`)
      setIntegrations(integrations.filter((i) => i.id !== id))
      if (selectedIntegration?.id === id) {
        setSelectedIntegration(null)
        setWebhookLogs([])
      }
    } catch (error) {
      console.error('Failed to delete integration:', error)
      alert('Failed to delete integration. Please check console for details.')
    }
  }

  const handleRegenerateKey = async (id: number) => {
    if (!confirm('Are you sure? This will invalidate the current webhook URL.')) return

    try {
      const response = await apiClient.post(`/integrations/${id}/regenerate-key`)
      setIntegrations(integrations.map((i) => (i.id === id ? response.data : i)))
      if (selectedIntegration?.id === id) {
        setSelectedIntegration(response.data)
      }
    } catch (error) {
      console.error('Failed to regenerate key:', error)
      alert('Failed to regenerate key. Please check console for details.')
    }
  }

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const getWebhookUrl = (integration: Integration) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    return `${apiUrl}/webhooks/${integration.type}/${integration.integrationKey}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-accent-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading font-bold text-dark-50 flex items-center gap-3 mb-2">
            <Webhook className="h-6 w-6" />
            Integration Settings
          </h2>
          <p className="text-dark-400">Manage webhook integrations and view activity logs</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Integration
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-dark-50 mb-4">Integrations</h3>
          {integrations.length === 0 ? (
            <div className="text-center py-8 text-dark-400">
              <Webhook className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No integrations configured yet</p>
              <p className="text-sm mt-1">Click "Add Integration" to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {integrations.map((integration) => (
                <div
                  key={integration.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedIntegration?.id === integration.id
                      ? 'border-accent-primary bg-accent-primary/5'
                      : 'border-dark-700 hover:border-dark-600'
                  }`}
                  onClick={() => {
                    setSelectedIntegration(integration)
                    fetchWebhookLogs(integration.id)
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {integrationTypes.find((t) => t.value === integration.type)?.icon || '🔗'}
                      </span>
                      <span className="font-medium text-dark-100">{integration.name}</span>
                    </div>
                    <Badge variant={integration.isActive ? 'success' : 'default'}>
                      {integration.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-sm text-dark-400">
                    {integrationTypes.find((t) => t.value === integration.type)?.label}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          {selectedIntegration ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-dark-50">
                  {selectedIntegration.name}
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRegenerateKey(selectedIntegration.id)}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Regenerate
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(selectedIntegration.id)}
                  >
                    <Trash2 className="h-3 w-3 text-status-critical" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Webhook URL
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={getWebhookUrl(selectedIntegration)}
                    readOnly
                    className="flex-1 font-mono text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(
                        getWebhookUrl(selectedIntegration),
                        `url-${selectedIntegration.id}`
                      )
                    }
                  >
                    {copiedKey === `url-${selectedIntegration.id}` ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">
                  Integration Key
                </label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={selectedIntegration.integrationKey}
                    readOnly
                    className="flex-1 font-mono text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(
                        selectedIntegration.integrationKey,
                        `key-${selectedIntegration.id}`
                      )
                    }
                  >
                    {copiedKey === `key-${selectedIntegration.id}` ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-dark-200">
                    Recent Webhook Calls
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchWebhookLogs(selectedIntegration.id)}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {webhookLogs.length === 0 ? (
                    <p className="text-sm text-dark-400 text-center py-4">No webhook calls yet</p>
                  ) : (
                    webhookLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-lg bg-dark-800 border border-dark-700"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                log.statusCode >= 200 && log.statusCode < 300
                                  ? 'success'
                                  : 'critical'
                              }
                            >
                              {log.statusCode}
                            </Badge>
                            <span className="text-sm font-mono text-dark-300">{log.method}</span>
                          </div>
                          <span className="text-xs text-dark-500">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {log.error && (
                          <div className="flex items-start gap-2 mt-2 text-xs text-red-400">
                            <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span>{log.error}</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-dark-700">
                <a
                  href="https://github.com/yourusername/openalert/wiki/Webhook-Integration"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-accent-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  View Integration Documentation
                </a>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-dark-400">
              <p>Select an integration to view details</p>
            </div>
          )}
        </Card>
      </div>

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add Integration"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Integration Name
            </label>
            <Input
              type="text"
              value={newIntegration.name}
              onChange={(e) =>
                setNewIntegration({ ...newIntegration, name: e.target.value })
              }
              placeholder="My Prometheus Integration"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">Type</label>
            <select
              value={newIntegration.type}
              onChange={(e) =>
                setNewIntegration({ ...newIntegration, type: e.target.value })
              }
              className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
            >
              {integrationTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.icon} {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">Service ID</label>
            <Input
              type="number"
              value={newIntegration.serviceId}
              onChange={(e) =>
                setNewIntegration({
                  ...newIntegration,
                  serviceId: parseInt(e.target.value),
                })
              }
              placeholder="1"
            />
            <p className="text-xs text-dark-500 mt-1">
              The service to associate alerts with. You'll need to create services first.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newIntegration.name}>
              Create Integration
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  )
}
