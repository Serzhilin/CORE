import { Card, Heading } from '@ecommons/ui'
import { useUser } from '../context/UserContext'
import styles from './OnboardingScreen.module.css'

export default function OnboardingScreen() {
  const { user } = useUser()

  function copy() {
    navigator.clipboard.writeText(user?.ename || '')
  }

  return (
    <div className={styles.screen}>
      <Card className={styles.card}>
        <Heading as="h1" className={styles.heading}>
          Welcome to CORE
        </Heading>
        <p className={styles.intro}>
          CORE manages your community's members, workgroups, and roles.
          You're logged in, but you haven't been added to any community yet.
        </p>
        <p className={styles.prompt}>
          Ask your community admin to add you. Share your eName:
        </p>
        <div className={`row ${styles.enameBox}`}>
          <span>{user?.ename || '(no eName — log in with W3DS wallet)'}</span>
          {user?.ename && (
            <button
              onClick={copy}
              className={styles.copyButton}
            >
              Copy
            </button>
          )}
        </div>
      </Card>
    </div>
  )
}
