import { useState, useEffect, useCallback } from 'react'
import QRCode from 'qrcode'
import { Card, Heading, ErrorText } from '@ecommons/ui'
import { getAuthOffer, subscribeToAuthSession } from '../api/client'

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

function OfferLink({ offer, copied, onCopy }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', maxWidth: 260 }}>
      <span style={{ fontSize: '0.7rem', color: 'var(--color-charcoal-light)', wordBreak: 'break-all', lineHeight: 1.4 }}>
        {offer}
      </span>
      <button
        onClick={onCopy}
        title="Copy link"
        style={{
          flexShrink: 0, background: 'none', border: '1px solid var(--color-sand)',
          borderRadius: 0, padding: 'var(--space-3) var(--space-6)', cursor: 'pointer',
          fontSize: '0.7rem', color: copied ? 'var(--color-terracotta)' : 'var(--color-charcoal-light)',
          lineHeight: 1,
        }}
      >
        {copied ? '✓' : 'copy'}
      </button>
    </div>
  )
}

export default function LoginScreen({ onSuccess }) {
  const [offer, setOffer] = useState(null)
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [status, setStatus] = useState('loading') // loading | waiting | error
  const [copied, setCopied] = useState(false)

  const copyOffer = useCallback(() => {
    if (!offer) return
    navigator.clipboard.writeText(offer).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [offer])

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
          const dataUrl = await QRCode.toDataURL(offerUrl, { width: 220, margin: 'var(--space-2)' })
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
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-28)' }}>
          <Heading as="h1" style={{ margin: '0 0 var(--space-6)' }}>
            CORE
          </Heading>
          <p style={{ color: 'var(--color-charcoal-light)', margin: 0, fontSize: '0.95rem' }}>
            Community Organisation & Roles Engine
          </p>
        </div>

        {/* Card */}
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
                      Download the{' '}
                      <a href="https://play.google.com/store/apps/details?id=foundation.metastate.eid_wallet" target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: 'var(--color-charcoal)', textDecoration: 'underline' }}>
                        eID wallet app
                      </a>
                      {' '}and scan the QR code to sign in.
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

              {/* Desktop: QR code + w3ds:// link */}
              {status === 'waiting' && !isMobile && qrDataUrl && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-8)' }}>
                  <div style={{ padding: 'var(--space-12)', background: 'white', borderRadius: 0, border: '1px solid var(--color-sand)', display: 'inline-block' }}>
                    <img src={qrDataUrl} alt="QR code" width={200} height={200} style={{ display: 'block' }} />
                  </div>
                  {offer && <OfferLink offer={offer} copied={copied} onCopy={copyOffer} />}
                </div>
              )}

              {/* Mobile: open wallet button + w3ds:// link */}
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
                  <OfferLink offer={offer} copied={copied} onCopy={copyOffer} />
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
  )
}
