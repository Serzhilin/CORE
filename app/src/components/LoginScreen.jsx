import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { Card, Heading, ErrorText } from '@ecommons/ui'
import { getAuthOffer, subscribeToAuthSession } from '../api/client'
import styles from './LoginScreen.module.css'

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
    <div className={`row ${styles.centeredContainer}`}>
      <div className={`login-layout ${styles.layoutInner}`}>

        {/* Left column (desktop) / top (mobile): brand */}
        <div className={`login-brand-col ${styles.brandCol}`}>
          <div className={`login-brand-header ${styles.brandHeader}`}>
            <img src="/logo.png" alt="CORE" className={styles.brandLogo} />
            <Heading as="h1" className={styles.brandTitle}>
              CORE
            </Heading>
          </div>
          <p className={styles.tagline}>
            Community Organisation & Roles Engine manages membership, workgroups and
            governance for your community. It works alongside other community-focused
            apps in eCommons. W3DS-native — all data is stored only in the community's
            and users' eVaults, nothing on the server.
          </p>

          <Heading as="h2" fontSize="1.25rem" className={styles.partnersHeading}>
            This app works together with:
          </Heading>
          <div className={`login-partner-grid ${styles.partnerGrid}`}>
            {[
              { name: 'WVTTK', logo: '/wvttk-logo.png', color: 'var(--color-terracotta)', desc: 'Plans workgroup meetings and agendas.', url: 'https://wvttk.lab.ecommons.space' },
              { name: 'ALVer', logo: '/alver-logo.png', color: 'var(--color-amber)', desc: 'Runs formal cooperative meetings and votes.', url: 'https://alver.lab.ecommons.space' },
              { name: 'Meshenger', logo: '/meshenger-logo.svg', color: 'var(--color-green)', desc: 'Chat, calls and files, synced to your Digital Self.', url: 'https://meshenger.postplatforms.com' },
            ].map((app) => (
              <a key={app.name} href={app.url} target="_blank" rel="noopener noreferrer" className={`stack ${styles.partnerCard}`}>
                {app.logo ? (
                  <img src={app.logo} alt={app.name} className={styles.partnerLogo} />
                ) : (
                  <div className={`row ${styles.partnerFallback}`} style={{ background: app.color }}>
                    {app.name[0]}
                  </div>
                )}
                <Heading as="h3" fontSize="1.05rem" className={styles.partnerName}>
                  {app.name}
                </Heading>
                <div className={styles.partnerDesc}>
                  {app.desc}
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Right column (desktop) / bottom (mobile): sign-in card + footer */}
        <div>
          <Card className={styles.signInCard}>
            <div className={`stack ${styles.cardStack}`}>
              <div className={`stack ${styles.innerStack}`}>

                {/* Instruction */}
                {status !== 'error' && (
                  <p className={styles.instruction}>
                    {isMobile ? (
                      <>
                        Download the{' '}
                        <a href="https://play.google.com/store/apps/details?id=foundation.metastate.eid_wallet" target="_blank" rel="noreferrer" className={styles.walletLink}>
                          eID wallet app
                        </a>
                        {' '}and tap the button below to sign in.
                      </>
                    ) : (
                      <>
                        To sign in, scan the QR code<br />
                        with the{' '}
                        <a href="https://play.google.com/store/apps/details?id=foundation.metastate.eid_wallet" target="_blank" rel="noreferrer" className={`${styles.walletLink} ${styles.walletLinkNowrap}`}>
                          eID wallet
                        </a>
                        .
                      </>
                    )}
                  </p>
                )}

                {/* Loading placeholder */}
                {status === 'loading' && (
                  <div className={`row ${styles.qrPlaceholder}`}>
                    <span className={styles.qrPlaceholderText}>Preparing…</span>
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
                  <div className={`stack ${styles.qrState}`}>
                    <div className={styles.qrBox}>
                      <img src={qrDataUrl} alt="QR code" width={200} height={200} className={styles.qrImg} />
                    </div>
                  </div>
                )}

                {/* Mobile: open wallet button */}
                {status === 'waiting' && isMobile && offer && (
                  <div className={`stack ${styles.qrState}`}>
                    <a href={offer} className={styles.walletBtn}>
                      Open W3DS Wallet
                    </a>
                  </div>
                )}

                {/* Expiry note */}
                {status === 'waiting' && (
                  <div className={styles.expiryNote}>
                    <p className={styles.expiryTitle}>
                      Valid for 5 minutes
                    </p>
                    <p className={styles.expiryHint}>If expired, refresh the page for a new code.</p>
                  </div>
                )}

                {/* W3DS info box */}
                <div className={styles.infoBox}>
                  This app uses W3DS — a decentralised identity standard — to authenticate without passwords.
                  Your identity is stored in your wallet, never on our servers.
                </div>

              </div>

            </div>
          </Card>

          {/* Footer: Project of eCommons + Metastate */}
          <div className={`row ${styles.footerLogos}`}>
            <span className={styles.footerLabel}>Project of</span>
            <a href="https://ecommons.space" target="_blank" rel="noopener noreferrer">
              <img src="/eCommons.svg" alt="eCommons" className={styles.footerLogoEcommons} />
            </a>
            <span className={styles.footerAnd}>and</span>
            <a href="https://metastate.foundation" target="_blank" rel="noopener noreferrer">
              <img src="/metastate.png" alt="Metastate" className={styles.footerLogoMetastate} />
            </a>
          </div>
        </div>

      </div>
    </div>
  )
}
