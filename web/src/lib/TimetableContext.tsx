import { createContext, useContext, useState, ReactNode } from 'react'

interface TimetableContextValue {
  open: boolean
  openTimetable: () => void
  closeTimetable: () => void
}

const TimetableContext = createContext<TimetableContextValue>({
  open: false,
  openTimetable: () => {},
  closeTimetable: () => {},
})

export function TimetableProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <TimetableContext.Provider value={{ open, openTimetable: () => setOpen(true), closeTimetable: () => setOpen(false) }}>
      {children}
    </TimetableContext.Provider>
  )
}

export function useTimetable() {
  return useContext(TimetableContext)
}
