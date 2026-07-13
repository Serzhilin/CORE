import { EmojiBadge } from '@ecommons/ui'

export default function AvailabilityBadge({ availability, inline = false }) {
  if (!availability) return null
  const { type, reason, until } = availability
  const tooltip = [reason, until ? `until ${until}` : null].filter(Boolean).join(' · ')

  return <EmojiBadge emoji={type.emoji} tooltip={tooltip || type.name} inline={inline} />
}
