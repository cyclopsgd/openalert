import { type UserRole } from '@/types/api'
import { getRoleDisplayName, getRoleColor } from '@/lib/permissions/permissions'
import { Badge } from '@/components/ui/Badge'

interface RoleBadgeProps {
  role: UserRole
  className?: string
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const displayName = getRoleDisplayName(role)
  const color = getRoleColor(role)

  const variantMap = {
    purple: 'default',
    blue: 'default',
    green: 'success',
    gray: 'default',
  } as const

  return (
    <Badge variant={variantMap[color]} className={className}>
      {displayName}
    </Badge>
  )
}
