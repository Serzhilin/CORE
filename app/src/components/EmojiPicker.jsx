import { useState, useEffect, useRef } from 'react'

const CATEGORIES = [
  {
    label: 'Health',
    emojis: ['🤒', '😷', '🤧', '🤕', '🏥', '💊', '🩺', '🩹', '🧬', '😓'],
  },
  {
    label: 'Away / Vacation',
    emojis: ['🏖', '🌴', '✈️', '🧳', '🌍', '🗺️', '⛵', '🏕', '🎿', '🛳️'],
  },
  {
    label: 'Home / Remote',
    emojis: ['🏠', '💻', '🛋️', '📱', '☕', '🐱', '🐶', '👶', '🧸', '🌿'],
  },
  {
    label: 'Time off',
    emojis: ['😴', '🛌', '🧘', '📚', '🎮', '🎨', '🎵', '🏃', '⚽', '🎉'],
  },
  {
    label: 'Other',
    emojis: ['⚠️', '🔒', '⏸️', '🚫', '❓', '🔧', '📵', '💬', '🗓️', '🌙'],
  },
]

export default function EmojiPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function pick(emoji) {
    onChange(emoji)
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Pick emoji"
        style={{
          width: 48, height: 36, fontSize: '1.2rem', cursor: 'pointer',
          borderRadius: 6, border: '1px solid var(--color-sand-dark)',
          background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxSizing: 'border-box',
        }}
      >
        {value || '＋'}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100,
          background: 'white', border: '1px solid var(--color-sand-dark)',
          borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          padding: 14, width: 260,
        }}>
          {CATEGORIES.map((cat) => (
            <div key={cat.label} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-charcoal-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
                {cat.label}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {cat.emojis.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => pick(e)}
                    style={{
                      width: 32, height: 32, fontSize: '1.1rem', cursor: 'pointer',
                      borderRadius: 6, border: 'none',
                      background: value === e ? 'var(--color-sand)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    onMouseEnter={(ev) => { if (value !== e) ev.currentTarget.style.background = 'var(--color-sand)' }}
                    onMouseLeave={(ev) => { if (value !== e) ev.currentTarget.style.background = 'transparent' }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
