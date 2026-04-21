import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getMe } from '../api/client'

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
