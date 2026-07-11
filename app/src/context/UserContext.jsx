import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getMe } from '../api/client'

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [user, setUser] = useState(null)           // full person object from /api/me
  const [memberships, setMemberships] = useState([]) // [{communityId, isAdmin, community}]
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadSession = useCallback(async () => {
    const token = localStorage.getItem('core_token')
    if (!token) { setLoading(false); return }
    try {
      const { person, memberships: m, isPlatformAdmin: ipa } = await getMe()
      setUser(person)
      setMemberships(m)
      setIsPlatformAdmin(!!ipa)
    } catch {
      localStorage.removeItem('core_token')
      setUser(null)
      setMemberships([])
      setIsPlatformAdmin(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSession() }, [loadSession])

  const login = useCallback((token, person, memberships, isPlatformAdmin) => {
    localStorage.setItem('core_token', token)
    setUser(person)
    setMemberships(memberships || [])
    setIsPlatformAdmin(!!isPlatformAdmin)
    setLoading(false)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('core_token')
    localStorage.removeItem('core_community_id')
    setUser(null)
    setMemberships([])
    setIsPlatformAdmin(false)
  }, [])

  const refreshMe = useCallback(async () => {
    try {
      const { person, memberships: m, isPlatformAdmin: ipa } = await getMe()
      setUser(person)
      setMemberships(m)
      setIsPlatformAdmin(!!ipa)
    } catch {}
  }, [])

  return (
    <UserContext.Provider value={{ user, memberships, isPlatformAdmin, loading, login, logout, refreshMe }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
