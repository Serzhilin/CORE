import { useEffect, useState } from 'react'

export default function DeeplinkLogin() {
  const [error, setError] = useState(null)

  useEffect(() => {
    async function run() {
      try {
        let searchString = window.location.search
        if (!searchString) {
          const hash = window.location.hash
          if (hash && hash.includes('?')) {
            searchString = hash.substring(hash.indexOf('?'))
          } else {
            try { searchString = new URL(window.location.href).search } catch {}
          }
        }
        if (searchString.startsWith('?')) searchString = searchString.substring(1)

        const params = new URLSearchParams(searchString)
        const ename     = params.get('ename')
        const session   = params.get('session')
        const signature = params.get('signature')

        if (!ename || !session || !signature) {
          setError('Missing authentication parameters')
          return
        }

        window.history.replaceState({}, '', window.location.pathname)

        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ename, session, signature }),
        })

        if (res.ok) {
          const data = await res.json()
          if (data.token) {
            localStorage.setItem('core_token', data.token)
            window.location.href = data.returnTo || '/'
          } else {
            setError('Invalid server response')
          }
        } else {
          let msg = 'Authentication failed'
          try { const d = await res.json(); msg = d.error || msg } catch {}
          setError(msg)
        }
      } catch {
        setError('Failed to connect to server')
      }
    }
    run()
  }, [])

  if (!error) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)', color: 'var(--color-charcoal-light)' }}>
        Authenticating…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 'var(--space-16)', fontFamily: 'var(--font-sans)' }}>
      <p style={{ color: 'var(--color-red)' }}>{error}</p>
      <a href="/" style={{ fontWeight: 700, color: 'var(--color-charcoal)', textDecoration: 'underline' }}>Back to home</a>
    </div>
  )
}
