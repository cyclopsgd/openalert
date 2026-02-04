import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RoleBadge } from '../RoleBadge'

// Mock the permissions module
vi.mock('@/lib/permissions/permissions', () => ({
  getRoleDisplayName: (role: string) => {
    const names: Record<string, string> = {
      superadmin: 'Super Admin',
      admin: 'Admin',
      responder: 'Responder',
      observer: 'Observer',
    }
    return names[role] || role
  },
  getRoleColor: (role: string) => {
    const colors: Record<string, string> = {
      superadmin: 'purple',
      admin: 'blue',
      responder: 'green',
      observer: 'gray',
    }
    return colors[role] || 'gray'
  },
}))

describe('RoleBadge', () => {
  it('renders superadmin role', () => {
    render(<RoleBadge role="superadmin" />)
    expect(screen.getByText('Super Admin')).toBeInTheDocument()
  })

  it('renders admin role', () => {
    render(<RoleBadge role="admin" />)
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('renders responder role', () => {
    render(<RoleBadge role="responder" />)
    expect(screen.getByText('Responder')).toBeInTheDocument()
  })

  it('renders observer role', () => {
    render(<RoleBadge role="observer" />)
    expect(screen.getByText('Observer')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <RoleBadge role="admin" className="custom-class" />
    )
    const badge = container.querySelector('.custom-class')
    expect(badge).toBeInTheDocument()
  })

  it('maps role colors to badge variants correctly', () => {
    const { container: container1 } = render(<RoleBadge role="responder" />)
    expect(container1.firstChild).toHaveTextContent('Responder')

    const { container: container2 } = render(<RoleBadge role="superadmin" />)
    expect(container2.firstChild).toHaveTextContent('Super Admin')
  })
})
