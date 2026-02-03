import { useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, Plus, Edit2, Trash2, ExternalLink, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useStatusPages, useCreateStatusPage, useUpdateStatusPage, useDeleteStatusPage } from '@/hooks/useStatusPages'
import { useServices } from '@/hooks/useServices'
import { useAuthStore } from '@/stores/authStore'
import { showToast } from '@/components/ui/Toast'
import type { CreateStatusPageDto, UpdateStatusPageDto } from '@/hooks/useStatusPages'

export function StatusPages() {
  const { user } = useAuthStore()
  const teamId = user?.teamId || 1
  const { data: statusPages = [], isLoading } = useStatusPages(teamId)
  const { data: services = [] } = useServices()
  const createStatusPage = useCreateStatusPage()
  const updateStatusPage = useUpdateStatusPage()
  const deleteStatusPage = useDeleteStatusPage()

  const [showModal, setShowModal] = useState(false)
  const [editingPage, setEditingPage] = useState<number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  const [formData, setFormData] = useState<{
    name: string
    slug: string
    description: string
    isPublic: boolean
    themeColor: string
    serviceIds: number[]
  }>({
    name: '',
    slug: '',
    description: '',
    isPublic: true,
    themeColor: '#3b82f6',
    serviceIds: [],
  })

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      isPublic: true,
      themeColor: '#3b82f6',
      serviceIds: [],
    })
    setEditingPage(null)
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: editingPage ? formData.slug : generateSlug(name),
    })
  }

  const handleEdit = async (pageId: number) => {
    const page = statusPages.find((p) => p.id === pageId)
    if (!page) return

    setFormData({
      name: page.name,
      slug: page.slug,
      description: page.description || '',
      isPublic: page.isPublic,
      themeColor: page.themeColor,
      serviceIds: [],
    })
    setEditingPage(pageId)
    setShowModal(true)
  }

  const handleCreate = () => {
    resetForm()
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showToast('Please enter a page name', 'error')
      return
    }

    if (!formData.slug.trim()) {
      showToast('Please enter a slug', 'error')
      return
    }

    if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      showToast('Slug can only contain lowercase letters, numbers, and hyphens', 'error')
      return
    }

    try {
      if (editingPage) {
        const updateData: UpdateStatusPageDto = {
          name: formData.name,
          slug: formData.slug,
          description: formData.description || undefined,
          isPublic: formData.isPublic,
          themeColor: formData.themeColor,
          serviceIds: formData.serviceIds,
        }
        await updateStatusPage.mutateAsync({ id: editingPage, data: updateData })
        showToast('Status page updated successfully', 'success')
      } else {
        const createData: CreateStatusPageDto = {
          name: formData.name,
          slug: formData.slug,
          description: formData.description || undefined,
          isPublic: formData.isPublic,
          themeColor: formData.themeColor,
          teamId,
          serviceIds: formData.serviceIds,
        }
        await createStatusPage.mutateAsync(createData)
        showToast('Status page created successfully', 'success')
      }
      setShowModal(false)
      resetForm()
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to save status page', 'error')
    }
  }

  const handleDelete = async (pageId: number) => {
    try {
      await deleteStatusPage.mutateAsync({ id: pageId, teamId })
      showToast('Status page deleted successfully', 'success')
      setDeleteConfirm(null)
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to delete status page', 'error')
    }
  }

  const getPublicUrl = (slug: string) => {
    return `${window.location.origin}/status/${slug}`
  }

  const copyUrl = (slug: string) => {
    const url = getPublicUrl(slug)
    navigator.clipboard.writeText(url)
    setCopiedUrl(slug)
    setTimeout(() => setCopiedUrl(null), 2000)
    showToast('URL copied to clipboard', 'success')
  }

  const toggleServiceSelection = (serviceId: number) => {
    setFormData({
      ...formData,
      serviceIds: formData.serviceIds.includes(serviceId)
        ? formData.serviceIds.filter((id) => id !== serviceId)
        : [...formData.serviceIds, serviceId],
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-accent-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-dark-50 flex items-center gap-3 mb-2">
            <BarChart3 className="h-8 w-8" />
            Status Pages
          </h1>
          <p className="text-dark-400">Create public status pages to communicate service health</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Status Page
        </Button>
      </div>

      {statusPages.length === 0 ? (
        <Card className="p-12 text-center">
          <BarChart3 className="h-16 w-16 mx-auto mb-4 text-dark-600" />
          <h3 className="text-xl font-semibold text-dark-200 mb-2">No status pages yet</h3>
          <p className="text-dark-400 mb-6">Create your first public status page to share service health with your users</p>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Status Page
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {statusPages.map((page) => (
            <Card key={page.id} className="p-6 hover:border-accent-primary transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-semibold text-dark-50 mb-1">{page.name}</h3>
                  {page.description && (
                    <p className="text-sm text-dark-400 mb-2">{page.description}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-dark-500">
                    <span className="font-mono">/status/{page.slug}</span>
                    <Badge variant={page.isPublic ? 'success' : 'secondary'}>
                      {page.isPublic ? 'Public' : 'Private'}
                    </Badge>
                  </div>
                </div>
                <div
                  className="w-8 h-8 rounded-full border-2 border-dark-700 flex-shrink-0"
                  style={{ backgroundColor: page.themeColor }}
                />
              </div>

              <div className="flex items-center gap-2 mb-4 text-sm text-dark-400">
                <BarChart3 className="h-4 w-4" />
                <span>{page.serviceCount} services</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => window.open(getPublicUrl(page.slug), '_blank')}
                  className="flex-1"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyUrl(page.slug)}
                >
                  {copiedUrl === page.slug ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleEdit(page.id)}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteConfirm(page.id)}
                >
                  <Trash2 className="h-3 w-3 text-status-critical" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          resetForm()
        }}
        title={editingPage ? 'Edit Status Page' : 'Create Status Page'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">Page Name</label>
            <Input
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="My Service Status"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">Slug</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-dark-400">/status/</span>
              <Input
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="my-service"
                className="flex-1"
              />
            </div>
            <p className="text-xs text-dark-500 mt-1">
              Only lowercase letters, numbers, and hyphens allowed
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">Description (Optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Public status page for our services"
              rows={3}
              className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-dark-100 placeholder:text-dark-400 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">Theme Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={formData.themeColor}
                onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                className="h-10 w-20 rounded border border-dark-600 bg-dark-800 cursor-pointer"
              />
              <Input
                value={formData.themeColor}
                onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                placeholder="#3b82f6"
                className="flex-1"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isPublic}
                onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                className="rounded border-dark-600"
              />
              <span className="text-sm font-medium text-dark-200">Make this page publicly accessible</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">Services to Display</label>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-dark-700 rounded-lg p-3 bg-dark-800">
              {services.length === 0 ? (
                <p className="text-sm text-dark-500 text-center py-2">
                  No services available. Create services first.
                </p>
              ) : (
                services.map((service) => (
                  <label key={service.id} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-dark-750 rounded">
                    <input
                      type="checkbox"
                      checked={formData.serviceIds.includes(service.id)}
                      onChange={() => toggleServiceSelection(service.id)}
                      className="rounded border-dark-600"
                    />
                    <span className="text-sm text-dark-200">{service.name}</span>
                    {service.description && (
                      <span className="text-xs text-dark-500 ml-auto">{service.description}</span>
                    )}
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
            <Button
              variant="ghost"
              onClick={() => {
                setShowModal(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} isLoading={createStatusPage.isPending || updateStatusPage.isPending}>
              {editingPage ? 'Update Page' : 'Create Page'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        title="Delete Status Page"
        description="Are you sure you want to delete this status page? This action cannot be undone and the public URL will stop working."
        confirmText="Delete"
        confirmVariant="danger"
      />
    </motion.div>
  )
}
