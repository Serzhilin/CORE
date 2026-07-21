import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { Card, Heading, ErrorText } from '@ecommons/ui'
import { getAuthOffer, subscribeToAuthSession } from '../api/client'

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

export default function LoginScreen({ onSuccess }) {
  const [offer, setOffer] = useState(null)
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [status, setStatus] = useState('loading') // loading | waiting | error

  useEffect(() => {
    let unsub = null
    let done = false

    function finish(token, user, memberships, isPlatformAdmin) {
      if (done) return
      done = true
      if (unsub) unsub()
      onSuccess(token, user, memberships, isPlatformAdmin)
    }

    getAuthOffer()
      .then(async ({ offer: offerUrl, sessionId }) => {
        setOffer(offerUrl)
        setStatus('waiting')

        if (!isMobile) {
          const dataUrl = await QRCode.toDataURL(offerUrl, { width: 220, margin: 2 })
          setQrDataUrl(dataUrl)
          unsub = subscribeToAuthSession(sessionId, ({ token, user, memberships, isPlatformAdmin }) =>
            finish(token, user, memberships, isPlatformAdmin)
          )
        }
      })
      .catch(() => setStatus('error'))

    return () => { done = true; if (unsub) unsub() }
  }, [])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-cream)', padding: 'var(--space-32) var(--space-20)',
    }}>
      <div className="login-layout" style={{ width: '100%', maxWidth: 960 }}>

        {/* Left column (desktop) / top (mobile): brand */}
        <div className="login-brand-col" style={{ paddingTop: 'var(--space-28)', paddingBottom: 'var(--space-28)' }}>
          <div className="login-brand-header" style={{ gap: 'var(--space-12)', marginBottom: 'var(--space-16)' }}>
            <img src="/logo.png" alt="CORE" style={{ height: 40, width: 40, objectFit: 'contain' }} />
            <Heading as="h1" style={{ margin: 0 }}>
              CORE
            </Heading>
          </div>
          <p style={{ color: 'var(--color-charcoal-light)', margin: 0, fontSize: '0.95rem', lineHeight: 1.6, maxWidth: 480 }}>
            Community Organisation & Roles Engine manages membership, workgroups and
            governance for your community. It works alongside other community-focused
            apps in eCommons. W3DS-native — all data is stored only in the community's
            and users' eVaults, nothing on the server.
          </p>

          <Heading as="h2" fontSize="1.25rem" style={{ margin: 'var(--space-32) 0 var(--space-16)' }}>
            This app works together with:
          </Heading>
          <div className="login-partner-grid" style={{ gap: 'var(--space-20)' }}>
            {[
              { name: 'WVTTK', logo: '/wvttk-logo.png', color: 'var(--color-terracotta)', desc: 'Plans workgroup meetings and agendas.', url: 'https://wvttk.lab.ecommons.space' },
              { name: 'ALVer', logo: '/alver-logo.png', color: 'var(--color-amber)', desc: 'Runs formal cooperative meetings and votes.', url: 'https://alver.lab.ecommons.space' },
              { name: 'Meshenger', logo: '/meshenger-logo.svg', color: 'var(--color-green)', desc: 'Chat, calls and files, synced to your Digital Self.', url: 'https://meshenger.postplatforms.com' },
            ].map((app) => (
              <a key={app.name} href={app.url} target="_blank" rel="noopener noreferrer" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
                {app.logo ? (
                  <img src={app.logo} alt={app.name} style={{ width: 48, height: 48, objectFit: 'contain', marginBottom: 'var(--space-10)' }} />
                ) : (
                  <div style={{
                    width: 48, height: 48, borderRadius: 0, background: app.color,
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '1.3rem', marginBottom: 'var(--space-10)',
                  }}>
                    {app.name[0]}
                  </div>
                )}
                <Heading as="h3" fontSize="1.05rem" style={{ marginBottom: 'var(--space-4)', textDecoration: 'underline' }}>
                  {app.name}
                </Heading>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-charcoal-light)', lineHeight: 1.5 }}>
                  {app.desc}
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Right column (desktop) / bottom (mobile): sign-in card + footer */}
        <div>
          <Card style={{ padding: 'var(--space-28)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-20)', width: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-16)', color: 'var(--color-charcoal-light)', textAlign: 'center', width: '100%' }}>

                {/* Instruction */}
                {status !== 'error' && (
                  <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.5 }}>
                    {isMobile ? (
                      <>
                        Download the{' '}
                        <a href="https://play.google.com/store/apps/details?id=foundation.metastate.eid_wallet" target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: 'var(--color-charcoal)', textDecoration: 'underline' }}>
                          eID wallet app
                        </a>
                        {' '}and tap the button below to sign in.
                      </>
                    ) : (
                      <>
                        To sign in, scan the QR code<br />
                        with the{' '}
                        <a href="https://play.google.com/store/apps/details?id=foundation.metastate.eid_wallet" target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: 'var(--color-charcoal)', textDecoration: 'underline', whiteSpace: 'nowrap' }}>
                          eID wallet
                        </a>
                        .
                      </>
                    )}
                  </p>
                )}

                {/* Loading placeholder */}
                {status === 'loading' && (
                  <div style={{ width: 220, height: 220, background: 'var(--color-sand)', borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'var(--color-charcoal-light)', fontSize: '0.85rem' }}>Preparing…</span>
                  </div>
                )}

                {/* Error */}
                {status === 'error' && (
                  <ErrorText as="p" fontSize="0.9rem" style={{ margin: 0 }}>
                    Could not reach auth server. Check API is running.
                  </ErrorText>
                )}

                {/* Desktop: QR code */}
                {status === 'waiting' && !isMobile && qrDataUrl && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-8)' }}>
                    <div style={{ padding: 'var(--space-12)', background: 'white', borderRadius: 0, border: '1px solid var(--color-sand)', display: 'inline-block' }}>
                      <img src={qrDataUrl} alt="QR code" width={200} height={200} style={{ display: 'block' }} />
                    </div>
                  </div>
                )}

                {/* Mobile: open wallet button */}
                {status === 'waiting' && isMobile && offer && (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-8)' }}>
                    <a
                      href={offer}
                      style={{
                        display: 'inline-flex', justifyContent: 'center', padding: 'var(--space-12) var(--space-28)',
                        background: 'var(--color-terracotta)', color: 'white', borderRadius: 0, fontWeight: 600,
                        fontSize: '1rem', textDecoration: 'none', width: '100%', boxSizing: 'border-box',
                      }}
                    >
                      Open W3DS Wallet
                    </a>
                  </div>
                )}

                {/* Expiry note */}
                {status === 'waiting' && (
                  <div style={{ fontSize: '0.85rem' }}>
                    <p style={{ margin: '0 0 var(--space-2)', fontWeight: 700, color: 'var(--color-charcoal)' }}>
                      Valid for 5 minutes
                    </p>
                    <p style={{ margin: 0 }}>If expired, refresh the page for a new code.</p>
                  </div>
                )}

                {/* W3DS info box */}
                <div style={{ background: 'rgba(0,0,0,0.04)', borderRadius: 0, padding: 'var(--space-12) var(--space-16)', fontSize: '0.82rem', lineHeight: 1.6, textAlign: 'left', color: 'var(--color-charcoal-light)' }}>
                  This app uses W3DS — a decentralised identity standard — to authenticate without passwords.
                  Your identity is stored in your wallet, never on our servers.
                </div>

              </div>

            </div>
          </Card>

          {/* Footer: Project of eCommons + Metastate */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-12)', paddingTop: 'var(--space-20)' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-charcoal-light)', whiteSpace: 'nowrap' }}>Project of</span>
            <a href="https://ecommons.space" target="_blank" rel="noopener noreferrer">
              <img src="/eCommons.svg" alt="eCommons" style={{ height: 28, opacity: 0.75 }} />
            </a>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-charcoal-light)' }}>and</span>
            <a href="https://metastate.foundation" target="_blank" rel="noopener noreferrer">
              <img src="/metastate.png" alt="Metastate" style={{ height: 28, opacity: 0.85 }} />
            </a>
          </div>
        </div>

      </div>
    </div>
  )
}
