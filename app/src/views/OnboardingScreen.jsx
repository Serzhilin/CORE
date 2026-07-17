import { Card, Heading } from '@ecommons/ui'
import { useUser } from '../context/UserContext'

export default function OnboardingScreen() {
  const { user } = useUser()

  function copy() {
    navigator.clipboard.writeText(user?.ename || '')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-cream)', padding: 'var(--space-24)',
    }}>
      <Card style={{ maxWidth: 480, width: '100%', padding: 'var(--space-32)', textAlign: 'center' }}>
        <Heading as="h1" style={{ marginBottom: 'var(--space-12)' }}>
          Welcome to CORE
        </Heading>
        <p style={{ color: 'var(--color-charcoal-light)', lineHeight: 1.7, marginBottom: 'var(--space-24)' }}>
          CORE manages your community's members, workgroups, and roles.
          You're logged in, but you haven't been added to any community yet.
        </p>
        <p style={{ color: 'var(--color-charcoal-light)', marginBottom: 'var(--space-16)' }}>
          Ask your community admin to add you. Share your eName:
        </p>
        <div style={{
          background: 'var(--color-sand)', borderRadius: 0, padding: 'var(--space-12) var(--space-16)',
          fontFamily: 'monospace', fontSize: '1rem', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-8)',
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
      </Card>
    </div>
  )
}
