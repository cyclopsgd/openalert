import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePermissions } from '../usePermissions'
import * as authStore from '@/stores/authStore'
import type { User } from '@/types/api'

// Mock the auth store
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(),
}))

describe('usePermissions', () => {
  const createMockUser = (role: User['role']): User => ({
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    externalId: 'ext-123',
    role,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('hasPermission', () => {
    it('returns true when user has permission', () => {
      vi.mocked(authStore.useAuthStore).mockReturnValue({
        user: createMockUser('admin'),
      } as any)

      const { result } = renderHook(() => usePermissions())
      expect(result.current.hasPermission('users.view')).toBe(true)
    })

    it('returns false when user does not have permission', () => {
      vi.mocked(authStore.useAuthStore).mockReturnValue({
        user: createMockUser('observer'),
      } as any)

      const { result } = renderHook(() => usePermissions())
      expect(result.current.hasPermission('users.create')).toBe(false)
    })

    it('returns false when user is undefined', () => {
      vi.mocked(authStore.useAuthStore).mockReturnValue({
        user: null,
      } as any)

      const { result } = renderHook(() => usePermissions())
      expect(result.current.hasPermission('users.view')).toBe(false)
    })
  })

  describe('canPerformAction', () => {
    it('returns true when user can perform action', () => {
      vi.mocked(authStore.useAuthStore).mockReturnValue({
        user: createMockUser('admin'),
      } as any)

      const { result } = renderHook(() => usePermissions())
      expect(result.current.canPerformAction('create', 'users')).toBe(true)
    })

    it('returns false when user cannot perform action', () => {
      vi.mocked(authStore.useAuthStore).mockReturnValue({
        user: createMockUser('observer'),
      } as any)

      const { result } = renderHook(() => usePermissions())
      expect(result.current.canPerformAction('delete', 'users')).toBe(false)
    })

    it('returns false when user is undefined', () => {
      vi.mocked(authStore.useAuthStore).mockReturnValue({
        user: null,
      } as any)

      const { result } = renderHook(() => usePermissions())
      expect(result.current.canPerformAction('view', 'users')).toBe(false)
    })
  })

  describe('getPermissions', () => {
    it('returns all permissions for superadmin', () => {
      vi.mocked(authStore.useAuthStore).mockReturnValue({
        user: createMockUser('superadmin'),
      } as any)

      const { result } = renderHook(() => usePermissions())
      const permissions = result.current.getPermissions()
      expect(permissions.length).toBeGreaterThan(0)
      expect(permissions).toContain('settings.edit')
      expect(permissions).toContain('users.delete')
    })

    it('returns limited permissions for observer', () => {
      vi.mocked(authStore.useAuthStore).mockReturnValue({
        user: createMockUser('observer'),
      } as any)

      const { result } = renderHook(() => usePermissions())
      const permissions = result.current.getPermissions()
      expect(permissions).toContain('incidents.view')
      expect(permissions).not.toContain('incidents.resolve')
      expect(permissions).not.toContain('users.create')
    })

    it('returns empty array when user is undefined', () => {
      vi.mocked(authStore.useAuthStore).mockReturnValue({
        user: null,
      } as any)

      const { result } = renderHook(() => usePermissions())
      expect(result.current.getPermissions()).toEqual([])
    })
  })

  describe('isRoleHigherOrEqualTo', () => {
    it('returns true when role is higher', () => {
      vi.mocked(authStore.useAuthStore).mockReturnValue({
        user: createMockUser('admin'),
      } as any)

      const { result } = renderHook(() => usePermissions())
      expect(result.current.isRoleHigherOrEqualTo('responder')).toBe(true)
    })

    it('returns true when role is equal', () => {
      vi.mocked(authStore.useAuthStore).mockReturnValue({
        user: createMockUser('admin'),
      } as any)

      const { result } = renderHook(() => usePermissions())
      expect(result.current.isRoleHigherOrEqualTo('admin')).toBe(true)
    })

    it('returns false when role is lower', () => {
      vi.mocked(authStore.useAuthStore).mockReturnValue({
        user: createMockUser('responder'),
      } as any)

      const { result } = renderHook(() => usePermissions())
      expect(result.current.isRoleHigherOrEqualTo('admin')).toBe(false)
    })

    it('returns false when user is undefined', () => {
      vi.mocked(authStore.useAuthStore).mockReturnValue({
        user: null,
      } as any)

      const { result } = renderHook(() => usePermissions())
      expect(result.current.isRoleHigherOrEqualTo('observer')).toBe(false)
    })
  })

  describe('role checking helpers', () => {
    it('isSuperadmin returns true for superadmin', () => {
      vi.mocked(authStore.useAuthStore).mockReturnValue({
        user: createMockUser('superadmin'),
      } as any)

      const { result } = renderHook(() => usePermissions())
      expect(result.current.isSuperadmin()).toBe(true)
    })

    it('isSuperadmin returns false for non-superadmin', () => {
      vi.mocked(authStore.useAuthStore).mockReturnValue({
        user: createMockUser('admin'),
      } as any)

      const { result } = renderHook(() => usePermissions())
      expect(result.current.isSuperadmin()).toBe(false)
    })

    it('isAdmin returns true for admin and superadmin', () => {
      vi.mocked(authStore.useAuthStore).mockReturnValue({
        user: createMockUser('admin'),
      } as any)

      const { result } = renderHook(() => usePermissions())
      expect(result.current.isAdmin()).toBe(true)

      vi.mocked(authStore.useAuthStore).mockReturnValue({
        user: createMockUser('superadmin'),
      } as any)

      const { result: result2 } = renderHook(() => usePermissions())
      expect(result2.current.isAdmin()).toBe(true)
    })

    it('isAdmin returns false for responder', () => {
      vi.mocked(authStore.useAuthStore).mockReturnValue({
        user: createMockUser('responder'),
      } as any)

      const { result } = renderHook(() => usePermissions())
      expect(result.current.isAdmin()).toBe(false)
    })

    it('isResponder returns true for responder, admin, and superadmin', () => {
      vi.mocked(authStore.useAuthStore).mockReturnValue({
        user: createMockUser('responder'),
      } as any)

      const { result } = renderHook(() => usePermissions())
      expect(result.current.isResponder()).toBe(true)

      vi.mocked(authStore.useAuthStore).mockReturnValue({
        user: createMockUser('admin'),
      } as any)

      const { result: result2 } = renderHook(() => usePermissions())
      expect(result2.current.isResponder()).toBe(true)
    })

    it('isResponder returns false for observer', () => {
      vi.mocked(authStore.useAuthStore).mockReturnValue({
        user: createMockUser('observer'),
      } as any)

      const { result } = renderHook(() => usePermissions())
      expect(result.current.isResponder()).toBe(false)
    })

    it('isObserver returns true for observer only', () => {
      vi.mocked(authStore.useAuthStore).mockReturnValue({
        user: createMockUser('observer'),
      } as any)

      const { result } = renderHook(() => usePermissions())
      expect(result.current.isObserver()).toBe(true)
    })

    it('isObserver returns false for responder', () => {
      vi.mocked(authStore.useAuthStore).mockReturnValue({
        user: createMockUser('responder'),
      } as any)

      const { result } = renderHook(() => usePermissions())
      expect(result.current.isObserver()).toBe(false)
    })
  })

  describe('userRole', () => {
    it('returns current user role', () => {
      vi.mocked(authStore.useAuthStore).mockReturnValue({
        user: createMockUser('admin'),
      } as any)

      const { result } = renderHook(() => usePermissions())
      expect(result.current.userRole).toBe('admin')
    })

    it('returns undefined when user is null', () => {
      vi.mocked(authStore.useAuthStore).mockReturnValue({
        user: null,
      } as any)

      const { result } = renderHook(() => usePermissions())
      expect(result.current.userRole).toBeUndefined()
    })
  })
})
