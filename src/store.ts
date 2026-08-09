import { create } from 'zustand'

export interface GlucoseReading {
  id: string
  timestamp: Date
  value: number
  unit: 'mg/dL' | 'mmol/L'
  source: 'CGM' | 'manual' | 'meter'
}

export interface InsulinEvent {
  id: string
  timestamp: Date
  type: 'bolus' | 'basal'
  dosage: number
  unit: 'U'
  notes?: string
}

export interface UserProfile {
  id: string
  name: string
  diabetesType: 'T1D' | 'T2D' | 'gestational' | 'other'
  glucoseRange: { min: number; max: number }
  weight: number
  height: number
  insulinType: string
}

export interface PatternDetected {
  id: string
  description: string
  timePeriod: string
  affectedReadings: number
  confidence: number
}

export interface AppState {
  // Theme
  colorScheme: 'light' | 'dark' | 'auto'
  setColorScheme: (scheme: 'light' | 'dark' | 'auto') => void

  // User profile
  userProfile: UserProfile | null
  setUserProfile: (profile: UserProfile) => void

  // Glucose readings
  readings: GlucoseReading[]
  addReading: (reading: GlucoseReading) => void
  addReadings: (readings: GlucoseReading[]) => void

  // Insulin events
  insulinEvents: InsulinEvent[]
  addInsulinEvent: (event: InsulinEvent) => void
  addInsulinEvents: (events: InsulinEvent[]) => void

  // Patterns
  patterns: PatternDetected[]
  setPatterns: (patterns: PatternDetected[]) => void

  // UI state
  isOnboarded: boolean
  setIsOnboarded: (value: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  colorScheme: 'auto',
  setColorScheme: (scheme) => set({ colorScheme: scheme }),

  userProfile: null,
  setUserProfile: (profile) => set({ userProfile: profile }),

  readings: [],
  addReading: (reading) => set((state) => ({ readings: [reading, ...state.readings] })),
  addReadings: (newReadings) =>
    set((state) => ({
      readings: [...newReadings, ...state.readings].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    })),

  insulinEvents: [],
  addInsulinEvent: (event) => set((state) => ({ insulinEvents: [event, ...state.insulinEvents] })),
  addInsulinEvents: (newEvents) =>
    set((state) => ({
      insulinEvents: [...newEvents, ...state.insulinEvents].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    })),

  patterns: [],
  setPatterns: (patterns) => set({ patterns }),

  isOnboarded: false,
  setIsOnboarded: (value) => set({ isOnboarded: value }),
}))
