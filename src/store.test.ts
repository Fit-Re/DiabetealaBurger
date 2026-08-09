import { useAppStore } from './store'

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      colorScheme: 'auto',
      userProfile: null,
      readings: [],
      insulinEvents: [],
      patterns: [],
      isOnboarded: false,
    })
  })

  describe('Color Scheme', () => {
    it('should initialize with auto color scheme', () => {
      const { colorScheme } = useAppStore.getState()
      expect(colorScheme).toBe('auto')
    })

    it('should update color scheme', () => {
      useAppStore.getState().setColorScheme('dark')
      expect(useAppStore.getState().colorScheme).toBe('dark')
    })
  })

  describe('User Profile', () => {
    it('should initialize with null userProfile', () => {
      const { userProfile } = useAppStore.getState()
      expect(userProfile).toBeNull()
    })

    it('should set user profile', () => {
      const profile = {
        id: '1',
        name: 'Test User',
        diabetesType: 'T1D' as const,
        glucoseRange: { min: 70, max: 180 },
        weight: 70,
        height: 175,
        insulinType: 'Rápida + Basal',
      }
      useAppStore.getState().setUserProfile(profile)
      expect(useAppStore.getState().userProfile).toEqual(profile)
    })
  })

  describe('Glucose Readings', () => {
    it('should initialize with empty readings', () => {
      const { readings } = useAppStore.getState()
      expect(readings).toEqual([])
    })

    it('should add single reading', () => {
      const reading = {
        id: '1',
        timestamp: new Date('2026-08-09T10:00:00'),
        value: 150,
        unit: 'mg/dL' as const,
        source: 'CGM' as const,
      }
      useAppStore.getState().addReading(reading)
      expect(useAppStore.getState().readings).toContainEqual(reading)
    })

    it('should add multiple readings in descending order by timestamp', () => {
      const reading1 = {
        id: '1',
        timestamp: new Date('2026-08-09T10:00:00'),
        value: 150,
        unit: 'mg/dL' as const,
        source: 'CGM' as const,
      }
      const reading2 = {
        id: '2',
        timestamp: new Date('2026-08-09T11:00:00'),
        value: 160,
        unit: 'mg/dL' as const,
        source: 'CGM' as const,
      }
      useAppStore.getState().addReadings([reading1, reading2])
      const readings = useAppStore.getState().readings
      expect(readings[0].timestamp.getTime()).toBeGreaterThan(readings[1].timestamp.getTime())
    })

    it('should handle empty readings array', () => {
      useAppStore.getState().addReadings([])
      expect(useAppStore.getState().readings).toEqual([])
    })
  })

  describe('Insulin Events', () => {
    it('should initialize with empty insulin events', () => {
      const { insulinEvents } = useAppStore.getState()
      expect(insulinEvents).toEqual([])
    })

    it('should add insulin event', () => {
      const event = {
        id: '1',
        timestamp: new Date('2026-08-09T10:00:00'),
        type: 'bolus' as const,
        dosage: 10,
        unit: 'U' as const,
      }
      useAppStore.getState().addInsulinEvent(event)
      expect(useAppStore.getState().insulinEvents).toContainEqual(event)
    })

    it('should add multiple insulin events in descending order', () => {
      const event1 = {
        id: '1',
        timestamp: new Date('2026-08-09T10:00:00'),
        type: 'bolus' as const,
        dosage: 10,
        unit: 'U' as const,
      }
      const event2 = {
        id: '2',
        timestamp: new Date('2026-08-09T11:00:00'),
        type: 'basal' as const,
        dosage: 0.5,
        unit: 'U' as const,
      }
      useAppStore.getState().addInsulinEvents([event1, event2])
      const events = useAppStore.getState().insulinEvents
      expect(events[0].timestamp.getTime()).toBeGreaterThan(events[1].timestamp.getTime())
    })
  })

  describe('Patterns', () => {
    it('should initialize with empty patterns', () => {
      const { patterns } = useAppStore.getState()
      expect(patterns).toEqual([])
    })

    it('should set patterns', () => {
      const patterns = [
        {
          id: '1',
          description: 'High after meals',
          timePeriod: '08:00 - 12:00',
          affectedReadings: 5,
          confidence: 0.85,
        },
      ]
      useAppStore.getState().setPatterns(patterns)
      expect(useAppStore.getState().patterns).toEqual(patterns)
    })
  })

  describe('Onboarding', () => {
    it('should initialize with isOnboarded false', () => {
      const { isOnboarded } = useAppStore.getState()
      expect(isOnboarded).toBe(false)
    })

    it('should set onboarding status', () => {
      useAppStore.getState().setIsOnboarded(true)
      expect(useAppStore.getState().isOnboarded).toBe(true)
    })
  })
})
