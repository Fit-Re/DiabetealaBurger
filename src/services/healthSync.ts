import { upsertGlucoseReadings, logEvent } from './supabase'
import { useAppStore } from '../store'

export interface FreestyleReading {
  id: string
  timestamp: Date
  value: number
  unit: 'mg/dL'
}

export interface UltrahumanData {
  id: string
  timestamp: Date
  metricType: 'sleep' | 'heart_rate' | 'activity'
  value: number
}

/**
 * Sync health data from external sources (Freestyle, Ultrahuman)
 * This runs in background every 15 minutes
 */
export async function syncHealthDataBackground(patientId: string): Promise<void> {
  try {
    await logEvent(patientId, 'health_sync_started', {
      timestamp: new Date().toISOString(),
    })

    // 1. Fetch from Freestyle API
    const glucoseReadings = await fetchFreestyleData(patientId)

    // 2. Fetch from Ultrahuman
    const ultrahumanData = await fetchUltrahumanData(patientId)

    // 3. Upsert glucose readings to Supabase
    if (glucoseReadings.length > 0) {
      await upsertGlucoseReadings(patientId, glucoseReadings)
      useAppStore.getState().addReadings(
        glucoseReadings.map((r) => ({
          id: r.id,
          timestamp: new Date(r.timestamp),
          value: r.value,
          unit: 'mg/dL' as const,
          source: 'CGM' as const,
        }))
      )
    }

    // 4. Log successful sync
    await logEvent(patientId, 'health_sync_completed', {
      glucoseReadingsCount: glucoseReadings.length,
      ultrahumanDataCount: ultrahumanData.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Health sync failed:', errorMessage)
    await logEvent(patientId, 'health_sync_failed', {
      error: errorMessage,
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Fetch glucose readings from Freestyle API
 * Returns empty array if API not available or credentials missing
 */
async function fetchFreestyleData(patientId: string): Promise<FreestyleReading[]> {
  try {
    // TODO: Replace with actual Freestyle API endpoint
    // This is a placeholder implementation
    const freestyleApiUrl = process.env.FREESTYLE_API_URL
    const freestyleToken = process.env.FREESTYLE_API_TOKEN

    if (!freestyleApiUrl || !freestyleToken) {
      console.warn('Freestyle API credentials not configured')
      return []
    }

    const response = await fetch(`${freestyleApiUrl}/readings?patientId=${patientId}`, {
      headers: {
        Authorization: `Bearer ${freestyleToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Freestyle API error: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    console.error('Failed to fetch Freestyle data:', error)
    return []
  }
}

/**
 * Fetch data from Ultrahuman API
 * Returns empty array if API not available or credentials missing
 */
async function fetchUltrahumanData(patientId: string): Promise<UltrahumanData[]> {
  try {
    // TODO: Replace with actual Ultrahuman API endpoint
    // This is a placeholder implementation
    const ultrahumanApiUrl = process.env.ULTRAHUMAN_API_URL
    const ultrahumanToken = process.env.ULTRAHUMAN_API_TOKEN

    if (!ultrahumanApiUrl || !ultrahumanToken) {
      console.warn('Ultrahuman API credentials not configured')
      return []
    }

    const response = await fetch(`${ultrahumanApiUrl}/data?patientId=${patientId}`, {
      headers: {
        Authorization: `Bearer ${ultrahumanToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Ultrahuman API error: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    console.error('Failed to fetch Ultrahuman data:', error)
    return []
  }
}
