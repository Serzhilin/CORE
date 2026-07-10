const BASE = '/api'
const SSE_BASE = import.meta.env.DEV ? 'http://localhost:3004/api' : '/api'

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
export const getCommunityGraph = (id) => req('GET', `/communities/${id}/graph`)
export const updateCommunity = (id, data) => req('PATCH', `/communities/${id}`, data)
export const resolveCommunityW3id = (id, w3id) => req('GET', `/communities/${id}/resolve-w3id?w3id=${encodeURIComponent(w3id)}`)
export const linkCommunityW3id = (id, w3id) => req('POST', `/communities/${id}/link-w3id`, { w3id })

// ── Members ───────────────────────────────────────────────────────────────────
export const listMembers = (cid) => req('GET', `/communities/${cid}/members`)
export const addMember = (cid, data) => req('POST', `/communities/${cid}/members`, data)
export const updateMember = (cid, pid, data) => req('PATCH', `/communities/${cid}/members/${pid}`, data)
export const removeMember = (cid, pid) => req('DELETE', `/communities/${cid}/members/${pid}`)
export const setMyAvailability = (cid, data) => req('PATCH', `/communities/${cid}/me/availability`, data)
export const setMemberAvailability = (cid, pid, data) => req('PATCH', `/communities/${cid}/members/${pid}/availability`, data)
export const getMemberAvailabilityLog = (cid, pid) => req('GET', `/communities/${cid}/members/${pid}/availability-log`)
export const updateMemberPerson = (cid, pid, data) => req('PATCH', `/communities/${cid}/members/${pid}/person`, data)

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
