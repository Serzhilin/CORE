import { useUser } from '../context/UserContext'

export default function OnboardingScreen() {
  const { user } = useUser()

  function copy() {
    navigator.clipboard.writeText(user?.ename || '')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-cream)', padding: 24,
    }}>
      <div className="card-warm" style={{ maxWidth: 480, width: '100%', padding: 40, textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '2rem', marginBottom: 12 }}>
          Welcome to CORE
        </h1>
        <p style={{ color: 'var(--color-charcoal-light)', lineHeight: 1.7, marginBottom: 24 }}>
          CORE manages your community's members, workgroups, and roles.
          You're logged in, but you haven't been added to any community yet.
        </p>
        <p style={{ color: 'var(--color-charcoal-light)', marginBottom: 16 }}>
          Ask your community admin to add you. Share your eName:
        </p>
        <div style={{
          background: 'var(--color-sand)', borderRadius: 0, padding: '12px 16px',
          fontFamily: 'monospace', fontSize: '1rem', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <span>{user?.ename || '(no eName — log in with W3DS wallet)'}</span>
          {user?.ename && (
            <button
              onClick={copy}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-charcoal-light)', fontSize: '0.8rem' }}
            >
              Copy
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
