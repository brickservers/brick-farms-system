import React, { createContext, useContext, useMemo, useState } from 'react'

export type PlanMode = 'demo' | 'free' | 'growth' | 'enterprise'

const limits: Record<PlanMode, { farms: number; plots: number; sensors: number; users: number }> = {
  demo: { farms: 2, plots: 6, sensors: 8, users: 3 },
  free: { farms: 1, plots: 3, sensors: 2, users: 1 },
  growth: { farms: 12, plots: 250, sensors: 150, users: 25 },
  enterprise: { farms: 999, plots: 9999, sensors: 5000, users: 1000 },
}

type PlanContextValue = {
  mode: PlanMode
  setMode: (mode: PlanMode) => void
  limits: typeof limits.demo
}

const PlanContext = createContext<PlanContextValue>({
  mode: 'demo',
  setMode: () => {},
  limits: limits.demo,
})

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<PlanMode>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('bf:plan-mode') : null
    return (saved as PlanMode) || 'demo'
  })

  const value = useMemo(() => {
    localStorage.setItem('bf:plan-mode', mode)
    return { mode, setMode, limits: limits[mode] }
  }, [mode])

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
}

export function usePlan() {
  return useContext(PlanContext)
}
