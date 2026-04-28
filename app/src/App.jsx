import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { UserProvider, useUser } from './context/UserContext'
import { CommunityProvider } from './context/CommunityContext'
import LoginScreen from './components/LoginScreen'
import Sidebar from './components/Sidebar'
import OnboardingScreen from './views/OnboardingScreen'

const OrganogramView = lazy(() => import('./views/OrganogramView'))
const MyProfile = lazy(() => import('./views/MyProfile'))
const AdminPanel = lazy(() => import('./views/AdminPanel'))

function Layout() {
  const { user, memberships, loading, login } = useUser()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Inter, sans-serif', color: 'var(--color-charcoal-light)' }}>
        Loading…
      </div>
    )
  }

  if (!user) {
    return <LoginScreen onSuccess={(token, person, memberships) => login(token, person, memberships)} />
  }

  if (!memberships.length) {
    return <OnboardingScreen />
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto', padding: 32, background: 'var(--color-cream)' }}>
        <Suspense fallback={<div style={{ color: 'var(--color-charcoal-light)' }}>Loading view…</div>}>
          <Routes>
            <Route path="/" element={<OrganogramView />} />
            <Route path="/profile" element={<MyProfile />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <CommunityProvider>
          <Layout />
        </CommunityProvider>
      </UserProvider>
    </BrowserRouter>
  )
}
