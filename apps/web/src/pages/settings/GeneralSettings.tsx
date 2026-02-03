import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Building2, Save, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

interface GeneralSettings {
  organizationName: string
  organizationLogoUrl: string
  defaultTimezone: string
  dateTimeFormat: string
  language: string
  companyWebsite: string
  supportEmail: string
}

const timezones = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
]

const dateTimeFormats = [
  'YYYY-MM-DD HH:mm:ss',
  'MM/DD/YYYY hh:mm A',
  'DD/MM/YYYY HH:mm',
  'YYYY-MM-DD hh:mm A',
]

export function GeneralSettings() {
  const [settings, setSettings] = useState<GeneralSettings>({
    organizationName: '',
    organizationLogoUrl: '',
    defaultTimezone: 'UTC',
    dateTimeFormat: 'YYYY-MM-DD HH:mm:ss',
    language: 'en',
    companyWebsite: '',
    supportEmail: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/system-settings/general', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      })
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      }
    } catch (error) {
      console.error('Failed to fetch general settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSuccess(false)
    try {
      const response = await fetch('http://localhost:3001/api/system-settings/general', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(settings),
      })

      if (response.ok) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      }
    } catch (error) {
      console.error('Failed to update general settings:', error)
    } finally {
      setSaving(false)
    }
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
      <div>
        <h2 className="text-2xl font-heading font-bold text-dark-50 flex items-center gap-3 mb-2">
          <Building2 className="h-6 w-6" />
          General Settings
        </h2>
        <p className="text-dark-400">Configure your organization's basic information and preferences</p>
      </div>

      <Card className="p-6 space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Organization Name
            </label>
            <Input
              type="text"
              value={settings.organizationName}
              onChange={(e) =>
                setSettings({ ...settings, organizationName: e.target.value })
              }
              placeholder="OpenAlert"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Organization Logo URL
            </label>
            <div className="flex gap-2">
              <Input
                type="url"
                value={settings.organizationLogoUrl}
                onChange={(e) =>
                  setSettings({ ...settings, organizationLogoUrl: e.target.value })
                }
                placeholder="https://example.com/logo.png"
                className="flex-1"
              />
              <Button variant="secondary" disabled>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </div>
            <p className="text-xs text-dark-500 mt-1">
              File upload coming soon. For now, provide a URL to your logo image.
            </p>
            {settings.organizationLogoUrl && (
              <div className="mt-3">
                <img
                  src={settings.organizationLogoUrl}
                  alt="Organization logo preview"
                  className="h-16 w-auto rounded border border-dark-700"
                  onError={(e) => {
                    e.currentTarget.src = ''
                    e.currentTarget.alt = 'Failed to load image'
                  }}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Default Timezone
              </label>
              <select
                value={settings.defaultTimezone}
                onChange={(e) =>
                  setSettings({ ...settings, defaultTimezone: e.target.value })
                }
                className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Date/Time Format
              </label>
              <select
                value={settings.dateTimeFormat}
                onChange={(e) =>
                  setSettings({ ...settings, dateTimeFormat: e.target.value })
                }
                className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
              >
                {dateTimeFormats.map((format) => (
                  <option key={format} value={format}>
                    {format}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Language
            </label>
            <select
              value={settings.language}
              onChange={(e) =>
                setSettings({ ...settings, language: e.target.value })
              }
              className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="ja">Japanese</option>
            </select>
            <p className="text-xs text-dark-500 mt-1">
              Multi-language support coming soon. This setting will be used in the future.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Company Website
            </label>
            <Input
              type="url"
              value={settings.companyWebsite}
              onChange={(e) =>
                setSettings({ ...settings, companyWebsite: e.target.value })
              }
              placeholder="https://example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Support Email
            </label>
            <Input
              type="email"
              value={settings.supportEmail}
              onChange={(e) =>
                setSettings({ ...settings, supportEmail: e.target.value })
              }
              placeholder="support@example.com"
            />
            <p className="text-xs text-dark-500 mt-1">
              This email will be displayed to users for support inquiries.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-dark-700">
          {success && (
            <p className="text-sm text-green-500">Settings saved successfully!</p>
          )}
          <div className="flex-1" />
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </Card>
    </motion.div>
  )
}
