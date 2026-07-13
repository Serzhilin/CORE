import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { Loading } from '@ecommons/ui'
import { UserProvider, useUser } from './context/UserContext'
import { CommunityProvider } from './context/CommunityContext'
import { TopBarSlotProvider } from './context/TopBarSlotContext'
import LoginScreen from './components/LoginScreen'
import TopBar from './components/TopBar'
import OnboardingScreen from './views/OnboardingScreen'
import DeeplinkLogin from './views/DeeplinkLogin'

const OrganogramView = lazy(() => import('./views/OrganogramView'))
const MyProfile = lazy(() => import('./views/MyProfile'))
const MyWorkgroups = lazy(() => import('./views/MyWorkgroups'))
const MyAvailability = lazy(() => import('./views/MyAvailability'))
const AdminPanel = lazy(() => import('./views/AdminPanel'))
const SuperadminPage = lazy(() => import('./views/SuperadminPage'))

function Layout() {
  const { user, memberships, loading, login } = useUser()

  if (loading) {
    return (
      <Loading style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'var(--font-sans)' }} />
    )
  }

  if (!user) {
    return <LoginScreen onSuccess={(token, person, memberships, isPlatformAdmin) => login(token, person, memberships, isPlatformAdmin)} />
  }

  if (!memberships.length) {
    return <OnboardingScreen />
  }

  return (
    <TopBarSlotProvider>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <TopBar />
        <main style={{ flex: 1, overflow: 'auto', padding: 32, background: 'var(--color-cream)', minHeight: 0 }}>
          <Suspense fallback={<Loading>Loading view…</Loading>}>
            <Routes>
              <Route path="/" element={<OrganogramView />} />
              <Route path="/profile" element={<MyProfile />} />
              <Route path="/my-workgroups" element={<MyWorkgroups />} />
              <Route path="/my-availability" element={<MyAvailability />} />
              <Route path="/admin/*" element={<AdminPanel />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </TopBarSlotProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/deeplink-login" element={<DeeplinkLogin />} />
        <Route path="/superadmin" element={
          <UserProvider>
            <Suspense fallback={<Loading style={{ padding: 32 }} />}>
              <SuperadminPage />
            </Suspense>
          </UserProvider>
        } />
        <Route path="*" element={
          <UserProvider>
            <CommunityProvider>
              <Layout />
            </CommunityProvider>
          </UserProvider>
        } />
      </Routes>
    </BrowserRouter>
  )
}
