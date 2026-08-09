// Supabase client initialization
// This file manages connection to Supabase backend

export interface SupabaseConfig {
  url: string
  anonKey: string
}

let supabaseConfig: SupabaseConfig | null = null

export function initSupabase(config: SupabaseConfig) {
  supabaseConfig = config
}

export function getSupabaseConfig(): SupabaseConfig {
  if (!supabaseConfig) {
    throw new Error('Supabase not initialized. Call initSupabase() first.')
  }
  return supabaseConfig
}

// Database operations
export async function fetchGlucoseReadings(patientId: string) {
  const config = getSupabaseConfig()
  const response = await fetch(
    `${config.url}/rest/v1/glucose_readings?patient_id=eq.${patientId}&order=timestamp.desc`,
    {
      headers: {
        Authorization: `Bearer ${config.anonKey}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch glucose readings: ${response.statusText}`)
  }

  return response.json()
}

export async function upsertGlucoseReadings(patientId: string, readings: any[]) {
  const config = getSupabaseConfig()
  const response = await fetch(`${config.url}/rest/v1/glucose_readings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.anonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(
      readings.map((r) => ({
        ...r,
        patient_id: patientId,
      }))
    ),
  })

  if (!response.ok) {
    throw new Error(`Failed to upsert glucose readings: ${response.statusText}`)
  }

  return response.json()
}

export async function logEvent(patientId: string, event: string, metadata?: any) {
  const config = getSupabaseConfig()
  const response = await fetch(`${config.url}/rest/v1/app_logs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      patient_id: patientId,
      event,
      metadata: metadata || {},
      timestamp: new Date().toISOString(),
    }),
  })

  if (!response.ok) {
    console.error(`Failed to log event: ${response.statusText}`)
    // Don't throw - logging failures shouldn't break the app
  }
}
