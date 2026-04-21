import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { getAuthOffer, subscribeToAuthSession, devLogin, getMe } from '../api/client'

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

export default function LoginScreen({ onSuccess }) {
  const [offer, setOffer] = useState(null)
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [status, setStatus] = useState('loading') // loading | waiting | error

  useEffect(() => {
    let unsub = null
    let done = false

    function finish(token, user, memberships) {
      if (done) return
      done = true
      if (unsub) unsub()
      onSuccess(token, user, memberships)
    }

    getAuthOffer()
      .then(async ({ offer: offerUrl, sessionId }) => {
        setOffer(offerUrl)
        setStatus('waiting')

        if (!isMobile) {
          const dataUrl = await QRCode.toDataURL(offerUrl, { width: 220, margin: 2 })
          setQrDataUrl(dataUrl)
          unsub = subscribeToAuthSession(sessionId, ({ token, user, memberships }) =>
            finish(token, user, memberships)
          )
        }
      })
      .catch(() => setStatus('error'))

    return () => { done = true; if (unsub) unsub() }
  }, [onSuccess])

  async function handleDevLogin() {
    try {
      const { token, user } = await devLogin()
      localStorage.setItem('core_token', token)
      const { person, memberships } = await getMe()
      localStorage.removeItem('core_token')
      onSuccess(token, person, memberships)
    } catch (e) {
      alert('Dev login failed: ' + e.message)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-cream)',
    }}>
      <div className="card" style={{ padding: 40, maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '2rem', marginBottom: 8, color: 'var(--color-charcoal)' }}>
          CORE
        </h1>
        <p style={{ color: 'var(--color-charcoal-light)', marginBottom: 32 }}>
          Community Organisation & Roles Engine
        </p>

        {status === 'loading' && <p style={{ color: 'var(--color-charcoal-light)' }}>Preparing login…</p>}

        {status === 'error' && <p style={{ color: 'var(--color-red)' }}>Could not reach auth server. Check API is running.</p>}

        {status === 'waiting' && (
          <>
            {isMobile ? (
              <a
                href={offer}
                className="btn-primary"
                style={{ display: 'inline-block', marginBottom: 16, textDecoration: 'none' }}
              >
                Open W3DS Wallet
              </a>
            ) : (
              qrDataUrl && (
                <div style={{ marginBottom: 16 }}>
                  <img src={qrDataUrl} alt="Scan with W3DS wallet" style={{ borderRadius: 8 }} />
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-charcoal-light)', marginTop: 8 }}>
                    Scan with your W3DS wallet app
                  </p>
                </div>
              )
            )}
          </>
        )}

        {import.meta.env.DEV && (
          <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--color-sand)' }}>
            <button className="btn-secondary" onClick={handleDevLogin} style={{ fontSize: '0.85rem' }}>
              Dev login (skip auth)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
