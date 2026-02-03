import { UserRole } from '@/types/api'
import { getRoleDisplayName, getRoleColor } from '@/lib/permissions/permissions'
import { Badge } from '@/components/ui/badge'

interface RoleBadgeProps {
  role: UserRole
  className?: string
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const displayName = getRoleDisplayName(role)
  const color = getRoleColor(role)

  const variantMap = {
    purple: 'default',
    blue: 'secondary',
    green: 'outline',
    gray: 'secondary',
  } as const

  return (
    <Badge variant={variantMap[color]} className={className}>
      {displayName}
    </Badge>
  )
}
