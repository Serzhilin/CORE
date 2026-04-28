# CORE Frontend Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the CORE React/Vite/Tailwind frontend with app scaffold, typed API client, ePassport auth, and sidebar layout — the foundation for all views.

**Architecture:** React 19 + Vite + Tailwind CSS, same design system as ALVer (CSS variables, Playfair Display + Inter fonts). API calls are proxied through Vite dev server to the CORE API on port 3002. Auth token stored in `localStorage` under `core_token`.

**Tech Stack:** React 19, React Router v7, Vite 8, Tailwind CSS 3, qrcode (QR generation), react-zoom-pan-pinch, html2canvas

**Context:** Backend (Tasks 1–9) is complete and running on port 3002. The `app/` directory does not exist yet and must be created from scratch. The root `package.json` already runs `npm run dev --prefix app` so the app just needs a `dev` script. **Plan B** (`2026-04-21-core-frontend-views.md`) implements all views (organogram, members, profile, admin) and depends on the scaffold from this plan.

---

## File Structure

```
app/
  package.json
  vite.config.js
  index.html
  tailwind.config.js
  postcss.config.js
  src/
    main.jsx                  React 19 createRoot entry
    App.jsx                   Router + providers + top-level layout
    index.css                 Design tokens (copied from ALVer)
    api/
      client.js               All typed fetch wrappers for CORE API
    context/
      UserContext.jsx         Auth token, current person, memberships
      CommunityContext.jsx    Current community full data + refresh
    components/
      LoginScreen.jsx         ePassport QR + mobile deeplink + dev login
      Sidebar.jsx             Nav sidebar + community switcher
    views/
      OnboardingScreen.jsx    Shown when person has no memberships
```

---

## Task 1: App Scaffold

**Files:**
- Create: `app/package.json`
- Create: `app/vite.config.js`
- Create: `app/index.html`
- Create: `app/tailwind.config.js`
- Create: `app/postcss.config.js`
- Create: `app/src/main.jsx`
- Create: `app/src/App.jsx`
- Create: `app/src/index.css`

- [ ] **Step 1: Create `app/package.json`**

```bash
mkdir -p /home/serzhilin/Projects/CORE/app/src/api
mkdir -p /home/serzhilin/Projects/CORE/app/src/context
mkdir -p /home/serzhilin/Projects/CORE/app/src/components
mkdir -p /home/serzhilin/Projects/CORE/app/src/views/admin
```

```json
{
  "name": "core-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "html2canvas": "^1.4.1",
    "qrcode": "^1.5.4",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "react-zoom-pan-pinch": "^3.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^6.0.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "vite": "^8.0.0"
  }
}
```

- [ ] **Step 2: Create `app/vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 3: Create `app/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CORE</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create `app/tailwind.config.js` and `app/postcss.config.js`**

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

```js
// postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 5: Copy `index.css` from ALVer**

```bash
cp /home/serzhilin/Projects/ALVer/app/src/index.css /home/serzhilin/Projects/CORE/app/src/index.css
```

Verify the copy:
```bash
head -5 /home/serzhilin/Projects/CORE/app/src/index.css
```
Expected: `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display...`

- [ ] **Step 6: Create `app/src/main.jsx`**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 7: Create `app/src/App.jsx` (skeleton — will be replaced in Task 5)**

```jsx
export default function App() {
  return <div style={{ padding: 32, fontFamily: 'Inter, sans-serif' }}>CORE loading…</div>
}
```

- [ ] **Step 8: Install dependencies**

```bash
cd /home/serzhilin/Projects/CORE/app
npm install
```

Expected: no errors. `node_modules/` created.

- [ ] **Step 9: Start dev server and verify**

```bash
cd /home/serzhilin/Projects/CORE/app
npm run dev &
sleep 3
curl -s http://localhost:5175/ | head -5
kill %1
```

Expected: HTML response with `<title>CORE</title>`.

- [ ] **Step 10: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/
git commit -m "feat: CORE app scaffold — Vite + React + Tailwind"
```

---

## Task 2: API Client

**Files:**
- Create: `app/src/api/client.js`

- [ ] **Step 1: Create `app/src/api/client.js`**

The SSE base must bypass Vite's dev proxy (which buffers SSE). In dev, connect directly to the API port.

```js
const BASE = '/api'
const SSE_BASE = import.meta.env.DEV ? 'http://localhost:3002/api' : '/api'

function getToken() {
  return localStorage.getItem('core_token')
}

async function req(method, path, body) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  if (res.status === 204) return null
  return res.json()
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const getAuthOffer = (returnTo) =>
  req('GET', `/auth/offer${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`)
export const loginWithWallet = (data) => req('POST', '/auth/login', data)
export const devLogin = (ename) => req('POST', '/auth/dev-login', { ename: ename || '@dev-user' })
export const getMe = () => req('GET', '/me')
export const updateMe = (data) => req('PATCH', '/me', data)

export function subscribeToAuthSession(sessionId, onLogin) {
  const es = new EventSource(`${SSE_BASE}/auth/sessions/${sessionId}`)
  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data)
      if (data.token) { onLogin(data); es.close() }
    } catch {}
  }
  es.onerror = () => es.close()
  return () => es.close()
}

// ── Communities ───────────────────────────────────────────────────────────────
export const listCommunities = () => req('GET', '/communities')
export const createCommunity = (data) => req('POST', '/communities', data)
export const getCommunity = (id) => req('GET', `/communities/${id}`)
export const updateCommunity = (id, data) => req('PATCH', `/communities/${id}`, data)

// ── Members ───────────────────────────────────────────────────────────────────
export const listMembers = (cid) => req('GET', `/communities/${cid}/members`)
export const addMember = (cid, data) => req('POST', `/communities/${cid}/members`, data)
export const updateMember = (cid, pid, data) => req('PATCH', `/communities/${cid}/members/${pid}`, data)
export const removeMember = (cid, pid) => req('DELETE', `/communities/${cid}/members/${pid}`)
export const setMyAvailability = (cid, data) => req('PATCH', `/communities/${cid}/me/availability`, data)
export const setMemberAvailability = (cid, pid, data) => req('PATCH', `/communities/${cid}/members/${pid}/availability`, data)
export const getMemberAvailabilityLog = (cid, pid) => req('GET', `/communities/${cid}/members/${pid}/availability-log`)

// ── Availability Types ────────────────────────────────────────────────────────
export const listAvailabilityTypes = (cid) => req('GET', `/communities/${cid}/availability-types`)
export const createAvailabilityType = (cid, data) => req('POST', `/communities/${cid}/availability-types`, data)
export const updateAvailabilityType = (cid, tid, data) => req('PATCH', `/communities/${cid}/availability-types/${tid}`, data)
export const archiveAvailabilityType = (cid, tid) => req('DELETE', `/communities/${cid}/availability-types/${tid}`)

// ── Workgroups ────────────────────────────────────────────────────────────────
export const listWorkgroups = (cid) => req('GET', `/communities/${cid}/workgroups`)
export const createWorkgroup = (cid, data) => req('POST', `/communities/${cid}/workgroups`, data)
export const updateWorkgroup = (cid, wid, data) => req('PATCH', `/communities/${cid}/workgroups/${wid}`, data)
export const deleteWorkgroup = (cid, wid) => req('DELETE', `/communities/${cid}/workgroups/${wid}`)

// ── Roles ─────────────────────────────────────────────────────────────────────
export const createRole = (wid, data) => req('POST', `/workgroups/${wid}/roles`, data)
export const updateRole = (wid, rid, data) => req('PATCH', `/workgroups/${wid}/roles/${rid}`, data)
export const deleteRole = (wid, rid) => req('DELETE', `/workgroups/${wid}/roles/${rid}`)

// ── Workgroup Members ─────────────────────────────────────────────────────────
export const addWorkgroupMember = (wid, data) => req('POST', `/workgroups/${wid}/members`, data)
export const updateWorkgroupMember = (wid, pid, data) => req('PATCH', `/workgroups/${wid}/members/${pid}`, data)
export const removeWorkgroupMember = (wid, pid) => req('DELETE', `/workgroups/${wid}/members/${pid}`)
export const assignRole = (wid, pid, data) => req('POST', `/workgroups/${wid}/members/${pid}/roles`, data)
export const unassignRole = (wid, pid, rid) => req('DELETE', `/workgroups/${wid}/members/${pid}/roles/${rid}`)
```

- [ ] **Step 2: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/api/client.js
git commit -m "feat: CORE API client — typed fetch wrappers for all endpoints"
```

---

## Task 3: Auth Context + Login Screen

**Files:**
- Modify: `api/src/controllers/AuthController.ts` (extend serializePerson)
- Create: `app/src/context/UserContext.jsx`
- Create: `app/src/components/LoginScreen.jsx`

The backend's `serializePerson` currently returns `{id, ename, firstName, lastName, displayName}`. The profile page needs `email, phone, bio, avatarUrl` — fix this first.

- [ ] **Step 1: Extend `serializePerson` in `api/src/controllers/AuthController.ts`**

Find the `serializePerson` function (near top of file) and replace it:

```typescript
function serializePerson(p: Person) {
    return {
        id: p.id,
        ename: p.ename,
        firstName: p.first_name,
        lastName: p.last_name,
        displayName: displayName(p),
        email: p.email,
        phone: p.phone,
        bio: p.bio,
        avatarUrl: p.avatar_url,
    };
}
```

- [ ] **Step 2: Verify TypeScript still compiles**

```bash
cd /home/serzhilin/Projects/CORE/api
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit the backend fix**

```bash
cd /home/serzhilin/Projects/CORE
git add api/src/controllers/AuthController.ts
git commit -m "fix: serializePerson includes email, phone, bio, avatarUrl for profile view"
```

- [ ] **Step 4: Create `app/src/context/UserContext.jsx`**

```jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getMe, listCommunities } from '../api/client'

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [user, setUser] = useState(null)           // full person object from /api/me
  const [memberships, setMemberships] = useState([]) // [{communityId, isAdmin, isAspirant, community}]
  const [loading, setLoading] = useState(true)

  const loadSession = useCallback(async () => {
    const token = localStorage.getItem('core_token')
    if (!token) { setLoading(false); return }
    try {
      const { person, memberships: m } = await getMe()
      setUser(person)
      setMemberships(m)
    } catch {
      localStorage.removeItem('core_token')
      setUser(null)
      setMemberships([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSession() }, [loadSession])

  const login = useCallback((token, person, memberships) => {
    localStorage.setItem('core_token', token)
    setUser(person)
    setMemberships(memberships || [])
    setLoading(false)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('core_token')
    localStorage.removeItem('core_community_id')
    setUser(null)
    setMemberships([])
  }, [])

  const refreshMe = useCallback(async () => {
    try {
      const { person, memberships: m } = await getMe()
      setUser(person)
      setMemberships(m)
    } catch {}
  }, [])

  return (
    <UserContext.Provider value={{ user, memberships, loading, login, logout, refreshMe }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
```

- [ ] **Step 5: Create `app/src/components/LoginScreen.jsx`**

```jsx
import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { getAuthOffer, subscribeToAuthSession, devLogin } from '../api/client'

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
      // After dev login, getMe gives us memberships
      const { getMe } = await import('../api/client')
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
```

- [ ] **Step 6: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/context/UserContext.jsx app/src/components/LoginScreen.jsx
git commit -m "feat: auth context + ePassport login screen"
```

---

## Task 4: Community Context

**Files:**
- Create: `app/src/context/CommunityContext.jsx`

The community context loads the full community (members + workgroups + roles) from `GET /api/communities/:id`. It derives the current user's membership from the loaded data.

`GET /api/communities/:id` response shape:
```js
{
  id, name, slug, description, logo_url, primary_color, title_font, ename, evault_uri, created_at, updated_at,
  members: [{
    membershipId, personId, firstName, lastName, email, avatarUrl,
    isAdmin, isAspirant, joinedAt,
    availability: { type: { id, name, emoji }, reason, from, until } | null
  }],
  workgroups: [{
    id, community_id, name, description, color, sort_order, created_at, updated_at,
    roles: [{ id, workgroup_id, name, description, color, sort_order }],
    members: [{ id, person_id, workgroup_id, is_workgroup_admin, created_at, roles: [roleId] }]
  }]
}
```

- [ ] **Step 1: Create `app/src/context/CommunityContext.jsx`**

```jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { listCommunities, getCommunity, listAvailabilityTypes } from '../api/client'
import { useUser } from './UserContext'

const CommunityContext = createContext(null)

export function CommunityProvider({ children }) {
  const { user, memberships } = useUser()
  const [communityId, setCommunityId] = useState(() => localStorage.getItem('core_community_id'))
  const [community, setCommunity] = useState(null)   // full community with members + workgroups
  const [availabilityTypes, setAvailabilityTypes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadCommunity = useCallback(async (id) => {
    if (!id) { setCommunity(null); setAvailabilityTypes([]); return }
    setLoading(true)
    setError(null)
    try {
      const [full, types] = await Promise.all([
        getCommunity(id),
        listAvailabilityTypes(id),
      ])
      setCommunity(full)
      setAvailabilityTypes(types)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // When memberships change, pick a community
  useEffect(() => {
    if (!memberships.length) { setCommunityId(null); setCommunity(null); return }

    const stored = localStorage.getItem('core_community_id')
    const valid = memberships.find((m) => m.communityId === stored)
    const id = valid ? stored : memberships[0].communityId
    setCommunityId(id)
    localStorage.setItem('core_community_id', id)
  }, [memberships])

  // Load whenever the selected community changes
  useEffect(() => { loadCommunity(communityId) }, [communityId, loadCommunity])

  const switchCommunity = useCallback((id) => {
    localStorage.setItem('core_community_id', id)
    setCommunityId(id)
  }, [])

  const refresh = useCallback(() => loadCommunity(communityId), [communityId, loadCommunity])

  // Current user's membership in the community
  const myMembership = community && user
    ? community.members.find((m) => m.personId === user.id) ?? null
    : null

  return (
    <CommunityContext.Provider value={{
      communityId, community, availabilityTypes,
      loading, error,
      myMembership,
      switchCommunity, refresh,
    }}>
      {children}
    </CommunityContext.Provider>
  )
}

export function useCommunity() {
  return useContext(CommunityContext)
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/context/CommunityContext.jsx
git commit -m "feat: community context — loads full community + availability types"
```

---

## Task 5: App Shell — Sidebar + Routing

**Files:**
- Create: `app/src/components/Sidebar.jsx`
- Create: `app/src/views/OnboardingScreen.jsx`
- Replace: `app/src/App.jsx` (full routing + providers)

- [ ] **Step 1: Create `app/src/views/OnboardingScreen.jsx`**

```jsx
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
          background: 'var(--color-sand)', borderRadius: 8, padding: '12px 16px',
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
```

- [ ] **Step 2: Create `app/src/components/Sidebar.jsx`**

```jsx
import { NavLink, useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { useCommunity } from '../context/CommunityContext'

export default function Sidebar() {
  const { user, memberships, logout } = useUser()
  const { communityId, community, myMembership, switchCommunity } = useCommunity()
  const navigate = useNavigate()

  const isAdmin = myMembership?.isAdmin ?? false
  const isWorkgroupAdmin = community?.workgroups?.some((wg) =>
    wg.members.some((m) => m.person_id === user?.id && m.is_workgroup_admin)
  ) ?? false

  const primaryColor = community?.primary_color || '#C4622D'

  function handleLogout() {
    logout()
    navigate('/')
  }

  const navStyle = { textDecoration: 'none', display: 'block', padding: '10px 16px', borderRadius: 8,
    color: 'var(--color-charcoal)', fontWeight: 500, fontSize: '0.95rem' }
  const activeStyle = { background: `${primaryColor}18`, color: primaryColor }

  return (
    <aside style={{
      width: 220, minHeight: '100vh', background: 'white',
      borderRight: '1px solid rgba(212,197,176,0.4)', display: 'flex',
      flexDirection: 'column', padding: '24px 12px', flexShrink: 0,
    }}>
      {/* Community name / switcher */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '1.1rem', padding: '0 4px', marginBottom: 8 }}>
          {community?.name || 'CORE'}
        </div>
        {memberships.length > 1 && (
          <select
            value={communityId || ''}
            onChange={(e) => switchCommunity(e.target.value)}
            style={{
              width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: '0.85rem',
              border: '1px solid var(--color-sand-dark)', background: 'white', cursor: 'pointer',
            }}
          >
            {memberships.map((m) => (
              <option key={m.communityId} value={m.communityId}>
                {m.community?.name || m.communityId}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Nav links */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        <NavLink to="/" end style={({ isActive }) => ({ ...navStyle, ...(isActive ? activeStyle : {}) })}>
          🗂 Organogram
        </NavLink>
        <NavLink to="/members" style={({ isActive }) => ({ ...navStyle, ...(isActive ? activeStyle : {}) })}>
          👥 Members
        </NavLink>
        <NavLink to="/profile" style={({ isActive }) => ({ ...navStyle, ...(isActive ? activeStyle : {}) })}>
          👤 My profile
        </NavLink>
        {(isAdmin || isWorkgroupAdmin) && (
          <NavLink to="/admin" style={({ isActive }) => ({ ...navStyle, ...(isActive ? activeStyle : {}) })}>
            ⚙️ Admin
          </NavLink>
        )}
      </nav>

      {/* User footer */}
      <div style={{ paddingTop: 16, borderTop: '1px solid var(--color-sand)', fontSize: '0.85rem', color: 'var(--color-charcoal-light)' }}>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>
          {user?.firstName || user?.ename || 'You'}
        </div>
        <button
          className="btn-secondary"
          onClick={handleLogout}
          style={{ width: '100%', fontSize: '0.8rem', padding: '6px 12px' }}
        >
          Log out
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Replace `app/src/App.jsx` with full routing**

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { UserProvider, useUser } from './context/UserContext'
import { CommunityProvider, useCommunity } from './context/CommunityContext'
import LoginScreen from './components/LoginScreen'
import Sidebar from './components/Sidebar'
import OnboardingScreen from './views/OnboardingScreen'

// Lazy placeholders — replaced in core-frontend-views plan
import { lazy, Suspense } from 'react'
const OrganogramView = lazy(() => import('./views/OrganogramView'))
const MembersTable = lazy(() => import('./views/MembersTable'))
const MyProfile = lazy(() => import('./views/MyProfile'))
const AdminPanel = lazy(() => import('./views/AdminPanel'))

function Layout() {
  const { user, memberships, loading, login } = useUser()
  const { community } = useCommunity()

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Inter, sans-serif', color: 'var(--color-charcoal-light)' }}>Loading…</div>
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
            <Route path="/members" element={<MembersTable />} />
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
```

- [ ] **Step 4: Create stub view files so the lazy imports don't 404**

The lazy imports in App.jsx point to views that will be built in Plan B. Create minimal stubs so the app loads without errors:

```bash
cat > /home/serzhilin/Projects/CORE/app/src/views/OrganogramView.jsx << 'EOF'
export default function OrganogramView() { return <div><h2>Organogram</h2><p>Coming soon — see core-frontend-views plan.</p></div> }
EOF

cat > /home/serzhilin/Projects/CORE/app/src/views/MembersTable.jsx << 'EOF'
export default function MembersTable() { return <div><h2>Members</h2><p>Coming soon.</p></div> }
EOF

cat > /home/serzhilin/Projects/CORE/app/src/views/MyProfile.jsx << 'EOF'
export default function MyProfile() { return <div><h2>My Profile</h2><p>Coming soon.</p></div> }
EOF

cat > /home/serzhilin/Projects/CORE/app/src/views/AdminPanel.jsx << 'EOF'
export default function AdminPanel() { return <div><h2>Admin</h2><p>Coming soon.</p></div> }
EOF
```

- [ ] **Step 5: Start API + app and verify full login flow**

In one terminal start the API (if not already running):
```bash
cd /home/serzhilin/Projects/CORE
npm run db:up
cd api && npm run dev &
sleep 3
```

In another, start the app:
```bash
cd /home/serzhilin/Projects/CORE/app
npm run dev &
sleep 3
```

Open http://localhost:5175 in a browser (or curl for smoke test):
```bash
curl -s http://localhost:5175/ | grep '<title>'
```
Expected: `<title>CORE</title>`

Test the dev login flow via API to verify integration:
```bash
TOKEN=$(curl -s -X POST http://localhost:3002/api/auth/dev-login \
  -H "Content-Type: application/json" -d '{"ename":"@scaffold-test"}' | jq -r .token)
curl -s http://localhost:3002/api/me \
  -H "Authorization: Bearer $TOKEN" | jq '{id: .person.id, email: .person.email}'
```
Expected: `{id: "<uuid>", email: null}` — confirms `email` now comes through in `/api/me`.

Kill background processes:
```bash
kill %1 %2 2>/dev/null || true
```

- [ ] **Step 6: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add app/src/
git commit -m "feat: app shell — sidebar layout, routing, auth flow, onboarding screen"
```

---

## Self-Review

**Spec coverage check:**

| Spec §5 requirement | Covered? |
|---|---|
| Sidebar layout + community switcher | ✅ Task 5 Sidebar.jsx |
| Login screen (ePassport QR + mobile deeplink) | ✅ Task 3 LoginScreen.jsx |
| Dev login | ✅ Task 3 LoginScreen.jsx |
| Onboarding screen (no memberships) | ✅ Task 5 OnboardingScreen.jsx |
| Organogram view | 🔜 Plan B |
| Members table | 🔜 Plan B |
| My profile | 🔜 Plan B |
| Admin panel | 🔜 Plan B |

**Placeholder scan:** No TBD / TODO / "similar to" patterns. All steps have complete code.

**Type consistency:** `serializePerson` in backend now returns `email, phone, bio, avatarUrl` — matches what UserContext stores and what MyProfile (Plan B) will read.

---

Plan complete and saved. Continue with **`2026-04-21-core-frontend-views.md`** for all views (organogram, members, profile, admin).
