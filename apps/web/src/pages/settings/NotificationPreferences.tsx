import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bell, Mail, MessageSquare, Smartphone, Moon, Clock, Save } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { Skeleton } from '@/components/ui/Skeleton'
import { useNotificationPreferences } from '@/hooks/useNotifications'

interface NotificationPreference {
  emailEnabled: boolean
  smsEnabled: boolean
  pushEnabled: boolean
  slackEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  notificationDelay: number
}

const eventTypes = [
  { id: 'incident.triggered', label: 'Incident Triggered', description: 'When a new incident is created' },
  { id: 'incident.acknowledged', label: 'Incident Acknowledged', description: 'When someone acknowledges an incident' },
  { id: 'incident.resolved', label: 'Incident Resolved', description: 'When an incident is resolved' },
  { id: 'incident.escalated', label: 'Incident Escalated', description: 'When an incident is escalated to you' },
  { id: 'incident.assigned', label: 'Incident Assigned', description: 'When an incident is assigned to you' },
]

export function NotificationPreferences() {
  const { success, error } = useToast()
  const { preferences, isLoading, updatePreferences, isUpdating } = useNotificationPreferences()

  const [localPreferences, setLocalPreferences] = useState<NotificationPreference>({
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: true,
    slackEnabled: false,
    quietHoursStart: '',
    quietHoursEnd: '',
    notificationDelay: 0,
  })

  const [phoneNumber, setPhoneNumber] = useState('')

  useEffect(() => {
    if (preferences) {
      setLocalPreferences({
        emailEnabled: preferences.emailEnabled ?? true,
        smsEnabled: preferences.smsEnabled ?? false,
        pushEnabled: preferences.pushEnabled ?? true,
        slackEnabled: preferences.slackEnabled ?? false,
        quietHoursStart: preferences.quietHoursStart ?? '',
        quietHoursEnd: preferences.quietHoursEnd ?? '',
        notificationDelay: preferences.notificationDelay ?? 0,
      })
      setPhoneNumber(preferences.phoneNumber ?? '')
    }
  }, [preferences])

  const handleSave = async () => {
    try {
      await updatePreferences({
        ...localPreferences,
        phoneNumber: phoneNumber || undefined,
      })
      success('Preferences saved', 'Your notification preferences have been updated successfully.')
    } catch (err) {
      console.error('Failed to update notification preferences:', err)
      error('Failed to save', 'An error occurred while saving your preferences.')
    }
  }

  const toggleChannel = (channel: keyof Pick<NotificationPreference, 'emailEnabled' | 'smsEnabled' | 'pushEnabled' | 'slackEnabled'>) => {
    setLocalPreferences((prev) => ({
      ...prev,
      [channel]: !prev[channel],
    }))
  }

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Card className="p-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-heading font-bold text-dark-50 flex items-center gap-3 mb-2">
          <Bell className="h-6 w-6" />
          Notification Preferences
        </h2>
        <p className="text-dark-400">
          Configure how and when you want to receive incident notifications
        </p>
      </div>

      {/* Notification Channels */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-dark-50 mb-4">Notification Channels</h3>
        <p className="text-sm text-dark-400 mb-6">
          Choose which channels you want to receive notifications through
        </p>

        <div className="space-y-4">
          {/* Email */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-dark-700 bg-dark-800/50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent-primary/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-accent-primary" />
              </div>
              <div>
                <h4 className="font-medium text-dark-50">Email Notifications</h4>
                <p className="text-sm text-dark-400">Receive notifications via email</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={localPreferences.emailEnabled}
                onChange={() => toggleChannel('emailEnabled')}
              />
              <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-primary"></div>
            </label>
          </div>

          {/* SMS */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-dark-700 bg-dark-800/50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent-primary/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-accent-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-dark-50">SMS Notifications</h4>
                <p className="text-sm text-dark-400">Receive notifications via text message</p>
                {localPreferences.smsEnabled && (
                  <div className="mt-2">
                    <Input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+1 234 567 8900"
                      className="max-w-xs"
                    />
                    <p className="text-xs text-dark-500 mt-1">
                      Include country code (e.g., +1 for US)
                    </p>
                  </div>
                )}
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={localPreferences.smsEnabled}
                onChange={() => toggleChannel('smsEnabled')}
              />
              <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-primary"></div>
            </label>
          </div>

          {/* Push */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-dark-700 bg-dark-800/50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent-primary/10 flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-accent-primary" />
              </div>
              <div>
                <h4 className="font-medium text-dark-50">Push Notifications</h4>
                <p className="text-sm text-dark-400">Receive browser push notifications</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={localPreferences.pushEnabled}
                onChange={() => toggleChannel('pushEnabled')}
              />
              <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-primary"></div>
            </label>
          </div>

          {/* Slack */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-dark-700 bg-dark-800/50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent-primary/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-accent-primary" />
              </div>
              <div>
                <h4 className="font-medium text-dark-50">Slack Notifications</h4>
                <p className="text-sm text-dark-400">Receive notifications via Slack DM</p>
                <p className="text-xs text-status-warning mt-1">Coming soon</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer opacity-50">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={localPreferences.slackEnabled}
                disabled
              />
              <div className="w-11 h-6 bg-dark-700 rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5"></div>
            </label>
          </div>
        </div>
      </Card>

      {/* Quiet Hours */}
      <Card className="p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-accent-primary/10 flex items-center justify-center">
            <Moon className="h-5 w-5 text-accent-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-dark-50">Quiet Hours</h3>
            <p className="text-sm text-dark-400 mt-1">
              Set a time range when you don't want to receive non-critical notifications
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">Start Time</label>
            <Input
              type="time"
              value={localPreferences.quietHoursStart}
              onChange={(e) =>
                setLocalPreferences({ ...localPreferences, quietHoursStart: e.target.value })
              }
              placeholder="22:00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">End Time</label>
            <Input
              type="time"
              value={localPreferences.quietHoursEnd}
              onChange={(e) =>
                setLocalPreferences({ ...localPreferences, quietHoursEnd: e.target.value })
              }
              placeholder="08:00"
            />
          </div>
        </div>
        <p className="text-xs text-dark-500 mt-2">
          During quiet hours, only critical incidents will notify you. Time is based on your timezone.
        </p>
      </Card>

      {/* Notification Delay */}
      <Card className="p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-accent-primary/10 flex items-center justify-center">
            <Clock className="h-5 w-5 text-accent-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-dark-50">Notification Delay</h3>
            <p className="text-sm text-dark-400 mt-1">
              Add a delay before receiving notifications to reduce alert fatigue
            </p>
          </div>
        </div>

        <div className="max-w-xs">
          <label className="block text-sm font-medium text-dark-200 mb-2">
            Delay (minutes)
          </label>
          <Input
            type="number"
            min="0"
            max="60"
            value={localPreferences.notificationDelay}
            onChange={(e) =>
              setLocalPreferences({
                ...localPreferences,
                notificationDelay: parseInt(e.target.value) || 0,
              })
            }
            placeholder="0"
          />
          <p className="text-xs text-dark-500 mt-2">
            Wait this many minutes before sending notifications. Someone else might handle the incident first.
          </p>
        </div>
      </Card>

      {/* Event Type Preferences */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-dark-50 mb-4">Notification Events</h3>
        <p className="text-sm text-dark-400 mb-6">
          Choose which event types you want to be notified about
        </p>

        <div className="space-y-3">
          {eventTypes.map((event) => (
            <label
              key={event.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-dark-800/50 border border-dark-700 cursor-pointer hover:bg-dark-800 transition-colors"
            >
              <input
                type="checkbox"
                defaultChecked
                className="mt-1 rounded border-dark-600 text-accent-primary focus:ring-accent-primary"
              />
              <div className="flex-1">
                <div className="font-medium text-dark-50">{event.label}</div>
                <div className="text-sm text-dark-400">{event.description}</div>
              </div>
            </label>
          ))}
        </div>
        <p className="text-xs text-dark-500 mt-4">
          Note: Event-specific preferences will be implemented in a future update. Currently, you will receive notifications for all events.
        </p>
      </Card>

      {/* Escalation Preferences */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-dark-50 mb-4">Escalation Preferences</h3>
        <p className="text-sm text-dark-400 mb-6">
          Configure how you want to be notified during escalations
        </p>

        <div className="space-y-4">
          <label className="flex items-center gap-3 p-3 rounded-lg bg-dark-800/50 border border-dark-700">
            <input
              type="checkbox"
              defaultChecked
              className="rounded border-dark-600 text-accent-primary focus:ring-accent-primary"
            />
            <div>
              <div className="font-medium text-dark-50">Immediate Escalation</div>
              <div className="text-sm text-dark-400">
                Bypass notification delay for escalated incidents
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-lg bg-dark-800/50 border border-dark-700">
            <input
              type="checkbox"
              defaultChecked
              className="rounded border-dark-600 text-accent-primary focus:ring-accent-primary"
            />
            <div>
              <div className="font-medium text-dark-50">Repeat Notifications</div>
              <div className="text-sm text-dark-400">
                Send repeated notifications until incident is acknowledged
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-lg bg-dark-800/50 border border-dark-700">
            <input
              type="checkbox"
              className="rounded border-dark-600 text-accent-primary focus:ring-accent-primary"
            />
            <div>
              <div className="font-medium text-dark-50">Multi-Channel Escalation</div>
              <div className="text-sm text-dark-400">
                Use all enabled channels for escalated incidents
              </div>
            </div>
          </label>
        </div>
        <p className="text-xs text-dark-500 mt-4">
          Note: Advanced escalation preferences will be implemented in a future update.
        </p>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-dark-700">
        <Button onClick={handleSave} disabled={isUpdating} size="lg">
          <Save className="h-4 w-4 mr-2" />
          {isUpdating ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </motion.div>
  )
}
