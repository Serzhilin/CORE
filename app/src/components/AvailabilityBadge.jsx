export default function AvailabilityBadge({ availability, inline = false }) {
  if (!availability) return null
  const { type, reason, until } = availability
  const tooltip = [reason, until ? `until ${until}` : null].filter(Boolean).join(' · ')

  return (
    <span
      className="emoji-mono"
      title={tooltip || type.name}
      style={{
        cursor: 'default',
        ...(inline ? { marginLeft: 4, fontSize: '0.85em' } : {}),
      }}
    >
      {type.emoji}
    </span>
  )
}
