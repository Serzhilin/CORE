import { createContext, useContext, useState, useEffect } from 'react'

const TopBarSlotContext = createContext(null)

export function TopBarSlotProvider({ children }) {
  const [slot, setSlot] = useState(null)
  return (
    <TopBarSlotContext.Provider value={{ slot, setSlot }}>
      {children}
    </TopBarSlotContext.Provider>
  )
}

export function useTopBarSlot() {
  return useContext(TopBarSlotContext)
}

export function useSetTopBarSlot(node, deps = []) {
  const { setSlot } = useContext(TopBarSlotContext)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setSlot(node)
    return () => setSlot(null)
  }, deps)
}
