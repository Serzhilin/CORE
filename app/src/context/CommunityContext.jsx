import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getCommunity, listAvailabilityTypes, listMembershipTypes } from '../api/client'
import { useUser } from './UserContext'

const CommunityContext = createContext(null)

export function CommunityProvider({ children }) {
  const { user, memberships } = useUser()
  const [communityId, setCommunityId] = useState(() => localStorage.getItem('core_community_id'))
  const [community, setCommunity] = useState(null)   // full community with members + workgroups
  const [availabilityTypes, setAvailabilityTypes] = useState([])
  const [membershipTypes, setMembershipTypes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadCommunity = useCallback(async (id) => {
    if (!id) { setCommunity(null); setAvailabilityTypes([]); setMembershipTypes([]); return }
    setLoading(true)
    setError(null)
    try {
      const [full, types, mTypes] = await Promise.all([
        getCommunity(id),
        listAvailabilityTypes(id),
        listMembershipTypes(id),
      ])
      setCommunity(full)
      setAvailabilityTypes(types)
      setMembershipTypes(mTypes)
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

  // Drive the app's block-shadow accent from the community's own brand color
  useEffect(() => {
    document.documentElement.style.setProperty('--block-shadow-color', community?.primary_color || '#2C2C2C')
  }, [community?.primary_color])

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
      communityId, community, availabilityTypes, membershipTypes,
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
