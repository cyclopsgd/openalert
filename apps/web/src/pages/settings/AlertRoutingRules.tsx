import { useState } from 'react'
import { motion } from 'framer-motion'
import { GitBranch, Plus, Edit2, Trash2, GripVertical, Play } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useRoutingRules, useCreateRoutingRule, useUpdateRoutingRule, useDeleteRoutingRule, useTestRoutingRule } from '@/hooks/useRoutingRules'
import { useServices } from '@/hooks/useServices'
import { toast } from '@/components/ui/Toast'
import type { RoutingRuleCondition, RoutingRuleAction, CreateRoutingRuleDto, UpdateRoutingRuleDto } from '@/hooks/useRoutingRules'

const conditionTypes = [
  { value: 'label_matches', label: 'Label Matches' },
  { value: 'source_equals', label: 'Source Equals' },
  { value: 'severity_in', label: 'Severity In' },
  { value: 'title_contains', label: 'Title Contains' },
  { value: 'description_regex', label: 'Description Regex' },
]

const sourceOptions = [
  { value: 'grafana', label: 'Grafana' },
  { value: 'prometheus', label: 'Prometheus' },
  { value: 'azure_monitor', label: 'Azure Monitor' },
  { value: 'datadog', label: 'Datadog' },
  { value: 'custom', label: 'Custom' },
]

const severityOptions = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'info', label: 'Info' },
]

export function AlertRoutingRules() {
  const teamId = 1 // TODO: Get teamId from user's team membership
  const { data: rules = [], isLoading } = useRoutingRules(teamId)
  const { data: services = [] } = useServices()
  const createRule = useCreateRoutingRule()
  const updateRule = useUpdateRoutingRule()
  const deleteRule = useDeleteRoutingRule()
  const testRule = useTestRoutingRule()

  const [showModal, setShowModal] = useState(false)
  const [editingRule, setEditingRule] = useState<number | null>(null)
  const [showTestModal, setShowTestModal] = useState(false)
  const [testRuleData, setTestRuleData] = useState<any>(null)
  const [testAlert, setTestAlert] = useState('')
  const [testResult, setTestResult] = useState<any>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  const [formData, setFormData] = useState<{
    name: string
    priority: number
    enabled: boolean
    matchAllConditions: boolean
    conditions: RoutingRuleCondition[]
    actions: RoutingRuleAction[]
  }>({
    name: '',
    priority: 1,
    enabled: true,
    matchAllConditions: true,
    conditions: [],
    actions: [],
  })

  const resetForm = () => {
    setFormData({
      name: '',
      priority: rules.length + 1,
      enabled: true,
      matchAllConditions: true,
      conditions: [],
      actions: [],
    })
    setEditingRule(null)
  }

  const handleEdit = (ruleId: number) => {
    const rule = rules.find((r) => r.id === ruleId)
    if (!rule) return

    setFormData({
      name: rule.name,
      priority: rule.priority,
      enabled: rule.enabled,
      matchAllConditions: rule.matchAllConditions,
      conditions: rule.conditions,
      actions: rule.actions,
    })
    setEditingRule(ruleId)
    setShowModal(true)
  }

  const handleCreate = () => {
    resetForm()
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a rule name')
      return
    }

    if (formData.conditions.length === 0) {
      toast.error('Please add at least one condition')
      return
    }

    if (formData.actions.length === 0) {
      toast.error('Please add at least one action')
      return
    }

    try {
      if (editingRule) {
        const updateData: UpdateRoutingRuleDto = {
          name: formData.name,
          priority: formData.priority,
          enabled: formData.enabled,
          matchAllConditions: formData.matchAllConditions,
          conditions: formData.conditions,
          actions: formData.actions,
        }
        await updateRule.mutateAsync({ id: editingRule, data: updateData })
        toast.success('Rule updated successfully')
      } else {
        const createData: CreateRoutingRuleDto = {
          name: formData.name,
          teamId,
          priority: formData.priority,
          enabled: formData.enabled,
          matchAllConditions: formData.matchAllConditions,
          conditions: formData.conditions,
          actions: formData.actions,
        }
        await createRule.mutateAsync(createData)
        toast.success('Rule created successfully')
      }
      setShowModal(false)
      resetForm()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save rule')
    }
  }

  const handleDelete = async (ruleId: number) => {
    try {
      await deleteRule.mutateAsync({ id: ruleId, teamId })
      toast.success('Rule deleted successfully')
      setDeleteConfirm(null)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete rule')
    }
  }

  const handleToggleEnabled = async (ruleId: number, enabled: boolean) => {
    try {
      await updateRule.mutateAsync({ id: ruleId, data: { enabled } })
      toast.success(`Rule ${enabled ? 'enabled' : 'disabled'}`)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update rule')
    }
  }

  const addCondition = (type: string) => {
    const newCondition: RoutingRuleCondition = { type: type as any }

    if (type === 'severity_in') {
      newCondition.values = []
    } else if (type === 'source_equals') {
      newCondition.value = 'custom'
    } else {
      newCondition.key = ''
      newCondition.value = ''
    }

    setFormData({ ...formData, conditions: [...formData.conditions, newCondition] })
  }

  const updateCondition = (index: number, updates: Partial<RoutingRuleCondition>) => {
    const conditions = [...formData.conditions]
    conditions[index] = { ...conditions[index], ...updates }
    setFormData({ ...formData, conditions })
  }

  const removeCondition = (index: number) => {
    setFormData({ ...formData, conditions: formData.conditions.filter((_, i) => i !== index) })
  }

  const addAction = (type: string) => {
    const newAction: RoutingRuleAction = { type: type as any }

    if (type === 'route_to_service') {
      newAction.serviceId = services[0]?.id
    } else if (type === 'set_severity') {
      newAction.severity = 'medium'
    } else if (type === 'add_tags') {
      newAction.tags = []
    }

    setFormData({ ...formData, actions: [...formData.actions, newAction] })
  }

  const updateAction = (index: number, updates: Partial<RoutingRuleAction>) => {
    const actions = [...formData.actions]
    actions[index] = { ...actions[index], ...updates }
    setFormData({ ...formData, actions })
  }

  const removeAction = (index: number) => {
    setFormData({ ...formData, actions: formData.actions.filter((_, i) => i !== index) })
  }

  const handleTestRule = async () => {
    try {
      const alertData = JSON.parse(testAlert)
      const result = await testRule.mutateAsync({
        conditions: testRuleData?.conditions || formData.conditions,
        matchAllConditions: testRuleData?.matchAllConditions ?? formData.matchAllConditions,
        alert: alertData,
      })
      setTestResult(result)
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        toast.error('Invalid JSON format')
      } else {
        toast.error(error.response?.data?.message || 'Test failed')
      }
    }
  }

  const openTestModal = (rule?: any) => {
    setTestRuleData(rule || null)
    setTestAlert(JSON.stringify({
      labels: { alertname: 'HighCPU', severity: 'critical' },
      annotations: { summary: 'High CPU usage detected' },
      source: 'prometheus',
    }, null, 2))
    setTestResult(null)
    setShowTestModal(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-accent-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading font-bold text-dark-50 flex items-center gap-3 mb-2">
            <GitBranch className="h-6 w-6" />
            Alert Routing Rules
          </h2>
          <p className="text-dark-400">Configure rules to route and manage incoming alerts</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Rule
        </Button>
      </div>

      <Card className="p-6">
        {rules.length === 0 ? (
          <div className="text-center py-12">
            <GitBranch className="h-12 w-12 mx-auto mb-3 text-dark-600" />
            <p className="text-dark-400 mb-4">No routing rules configured yet</p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create your first rule
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-dark-400 w-12"></th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-dark-400 w-20">Priority</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-dark-400">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-dark-400">Enabled</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-dark-400">Conditions</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-dark-400">Actions</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-dark-400">Matches</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-dark-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.sort((a, b) => a.priority - b.priority).map((rule) => (
                  <tr key={rule.id} className="border-b border-dark-800 hover:bg-dark-800/50">
                    <td className="py-3 px-4">
                      <GripVertical className="h-4 w-4 text-dark-500 cursor-move" />
                    </td>
                    <td className="py-3 px-4 text-sm text-dark-300">{rule.priority}</td>
                    <td className="py-3 px-4 text-sm text-dark-100 font-medium">{rule.name}</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleEnabled(rule.id, !rule.enabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          rule.enabled ? 'bg-accent-primary' : 'bg-dark-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            rule.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {rule.conditions.slice(0, 2).map((cond, i) => (
                          <Badge key={i} variant="default" className="text-xs">
                            {cond.type.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                        {rule.conditions.length > 2 && (
                          <Badge variant="default" className="text-xs">
                            +{rule.conditions.length - 2}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {rule.actions.slice(0, 2).map((action, i) => (
                          <Badge key={i} variant="info" className="text-xs">
                            {action.type.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                        {rule.actions.length > 2 && (
                          <Badge variant="info" className="text-xs">
                            +{rule.actions.length - 2}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-dark-300">{rule.matchCount}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openTestModal(rule)}
                        >
                          <Play className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(rule.id)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm(rule.id)}
                        >
                          <Trash2 className="h-3 w-3 text-status-critical" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          resetForm()
        }}
        title={editingRule ? 'Edit Rule' : 'Create Rule'}
        size="xl"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">Rule Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Routing Rule"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">Priority</label>
              <Input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
                min={1}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-primary"></div>
              <span className="ml-3 text-sm font-medium text-dark-200">Enabled</span>
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-dark-200">Conditions</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-dark-400">Match:</span>
                <button
                  onClick={() => setFormData({ ...formData, matchAllConditions: true })}
                  className={`px-3 py-1 text-xs rounded ${
                    formData.matchAllConditions
                      ? 'bg-accent-primary text-white'
                      : 'bg-dark-700 text-dark-400'
                  }`}
                >
                  ALL
                </button>
                <button
                  onClick={() => setFormData({ ...formData, matchAllConditions: false })}
                  className={`px-3 py-1 text-xs rounded ${
                    !formData.matchAllConditions
                      ? 'bg-accent-primary text-white'
                      : 'bg-dark-700 text-dark-400'
                  }`}
                >
                  ANY
                </button>
              </div>
            </div>

            <div className="space-y-2 mb-3">
              {formData.conditions.map((condition, index) => (
                <div key={index} className="p-3 rounded-lg bg-dark-800 border border-dark-700">
                  <div className="flex items-start gap-3">
                    <select
                      value={condition.type}
                      onChange={(e) => updateCondition(index, { type: e.target.value as any })}
                      className="px-3 py-1.5 bg-dark-700 border border-dark-600 rounded text-dark-100 text-sm"
                    >
                      {conditionTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>

                    <div className="flex-1 space-y-2">
                      {condition.type === 'label_matches' && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Key"
                            value={condition.key || ''}
                            onChange={(e) => updateCondition(index, { key: e.target.value })}
                            className="text-sm"
                          />
                          <Input
                            placeholder="Value"
                            value={condition.value || ''}
                            onChange={(e) => updateCondition(index, { value: e.target.value })}
                            className="text-sm"
                          />
                        </div>
                      )}

                      {condition.type === 'source_equals' && (
                        <select
                          value={condition.value || 'custom'}
                          onChange={(e) => updateCondition(index, { value: e.target.value })}
                          className="w-full px-3 py-1.5 bg-dark-700 border border-dark-600 rounded text-dark-100 text-sm"
                        >
                          {sourceOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      )}

                      {condition.type === 'severity_in' && (
                        <div className="flex flex-wrap gap-2">
                          {severityOptions.map((sev) => (
                            <label key={sev.value} className="flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={condition.values?.includes(sev.value) || false}
                                onChange={(e) => {
                                  const values = condition.values || []
                                  if (e.target.checked) {
                                    updateCondition(index, { values: [...values, sev.value] })
                                  } else {
                                    updateCondition(index, { values: values.filter((v) => v !== sev.value) })
                                  }
                                }}
                                className="rounded border-dark-600"
                              />
                              <span className="text-xs text-dark-300">{sev.label}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {(condition.type === 'title_contains' || condition.type === 'description_regex') && (
                        <Input
                          placeholder={condition.type === 'title_contains' ? 'Text to search' : 'Regex pattern'}
                          value={condition.value || ''}
                          onChange={(e) => updateCondition(index, { value: e.target.value })}
                          className="text-sm"
                        />
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCondition(index)}
                    >
                      <Trash2 className="h-3 w-3 text-status-critical" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="relative">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    addCondition(e.target.value)
                    e.target.value = ''
                  }
                }}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded text-dark-100 text-sm"
              >
                <option value="">+ Add Condition</option>
                {conditionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-3">Actions</label>

            <div className="space-y-2 mb-3">
              {formData.actions.map((action, index) => (
                <div key={index} className="p-3 rounded-lg bg-dark-800 border border-dark-700">
                  <div className="flex items-start gap-3">
                    <select
                      value={action.type}
                      onChange={(e) => updateAction(index, { type: e.target.value as any })}
                      className="px-3 py-1.5 bg-dark-700 border border-dark-600 rounded text-dark-100 text-sm"
                    >
                      <option value="route_to_service">Route to Service</option>
                      <option value="set_severity">Set Severity</option>
                      <option value="suppress">Suppress Alert</option>
                      <option value="add_tags">Add Tags</option>
                    </select>

                    <div className="flex-1">
                      {action.type === 'route_to_service' && (
                        <select
                          value={action.serviceId || ''}
                          onChange={(e) => updateAction(index, { serviceId: parseInt(e.target.value) })}
                          className="w-full px-3 py-1.5 bg-dark-700 border border-dark-600 rounded text-dark-100 text-sm"
                        >
                          <option value="">Select service</option>
                          {services.map((svc) => (
                            <option key={svc.id} value={svc.id}>
                              {svc.name}
                            </option>
                          ))}
                        </select>
                      )}

                      {action.type === 'set_severity' && (
                        <select
                          value={action.severity || 'medium'}
                          onChange={(e) => updateAction(index, { severity: e.target.value })}
                          className="w-full px-3 py-1.5 bg-dark-700 border border-dark-600 rounded text-dark-100 text-sm"
                        >
                          {severityOptions.map((sev) => (
                            <option key={sev.value} value={sev.value}>
                              {sev.label}
                            </option>
                          ))}
                        </select>
                      )}

                      {action.type === 'add_tags' && (
                        <Input
                          placeholder="tag1, tag2, tag3"
                          value={action.tags?.join(', ') || ''}
                          onChange={(e) => updateAction(index, { tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                          className="text-sm"
                        />
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAction(index)}
                    >
                      <Trash2 className="h-3 w-3 text-status-critical" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="relative">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    addAction(e.target.value)
                    e.target.value = ''
                  }
                }}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded text-dark-100 text-sm"
              >
                <option value="">+ Add Action</option>
                <option value="route_to_service">Route to Service</option>
                <option value="set_severity">Set Severity</option>
                <option value="suppress">Suppress Alert</option>
                <option value="add_tags">Add Tags</option>
              </select>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-dark-700">
            <Button variant="secondary" onClick={() => openTestModal()}>
              <Play className="h-4 w-4 mr-2" />
              Test Rule
            </Button>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowModal(false)
                  resetForm()
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} isLoading={createRule.isPending || updateRule.isPending}>
                {editingRule ? 'Update Rule' : 'Create Rule'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showTestModal}
        onClose={() => setShowTestModal(false)}
        title="Test Routing Rule"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">Sample Alert JSON</label>
            <textarea
              value={testAlert}
              onChange={(e) => setTestAlert(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded text-dark-100 font-mono text-xs"
            />
          </div>

          {testResult && (
            <div className="p-4 rounded-lg bg-dark-800 border border-dark-700">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant={testResult.matched ? 'success' : 'critical'}>
                  {testResult.matched ? 'Matched' : 'Not Matched'}
                </Badge>
              </div>

              {testResult.matchedConditions.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-dark-400 mb-1">Matched Conditions:</p>
                  <div className="space-y-1">
                    {testResult.matchedConditions.map((cond: string, i: number) => (
                      <p key={i} className="text-xs text-green-400">✓ {cond}</p>
                    ))}
                  </div>
                </div>
              )}

              {testResult.failedConditions.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-dark-400 mb-1">Failed Conditions:</p>
                  <div className="space-y-1">
                    {testResult.failedConditions.map((cond: string, i: number) => (
                      <p key={i} className="text-xs text-red-400">✗ {cond}</p>
                    ))}
                  </div>
                </div>
              )}

              {testResult.matched && testResult.actions.length > 0 && (
                <div>
                  <p className="text-xs text-dark-400 mb-1">Actions that would be applied:</p>
                  <div className="flex flex-wrap gap-1">
                    {testResult.actions.map((action: any, i: number) => (
                      <Badge key={i} variant="info" className="text-xs">
                        {action.type.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowTestModal(false)}>
              Close
            </Button>
            <Button onClick={handleTestRule} isLoading={testRule.isPending}>
              Test
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        title="Delete Routing Rule"
        description="Are you sure you want to delete this routing rule? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </motion.div>
  )
}
