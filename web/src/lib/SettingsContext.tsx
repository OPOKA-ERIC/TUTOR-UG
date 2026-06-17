import { createContext, useContext, useState, ReactNode } from 'react'

interface SettingsContextValue {
  open: boolean
  openSettings: () => void
  closeSettings: () => void
}

const SettingsContext = createContext<SettingsContextValue>({
  open: false,
  openSettings: () => {},
  closeSettings: () => {},
})

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <SettingsContext.Provider value={{ open, openSettings: () => setOpen(true), closeSettings: () => setOpen(false) }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}
