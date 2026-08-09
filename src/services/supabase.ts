import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseClient: SupabaseClient | null = null

export function initSupabase(url: string, anonKey: string) {
  supabaseClient = createClient(url, anonKey)
}

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error('Supabase not initialized. Call initSupabase() first.')
  }
  return supabaseClient
}

export async function getCurrentUser() {
  const client = getSupabaseClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  return user
}

export async function signInWithEmail(email: string, password: string) {
  const client = getSupabaseClient()
  return client.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  const client = getSupabaseClient()
  return client.auth.signOut()
}

export async function fetchGlucoseReadings(patientId: string) {
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('glucose_readings')
    .select('*')
    .eq('patient_id', patientId)
    .order('timestamp_ms', { ascending: false })
    .limit(100)

  if (error) {
    throw new Error(`Failed to fetch glucose readings: ${error.message}`)
  }

  return data || []
}

export async function upsertGlucoseReadings(patientId: string, readings: any[]) {
  const client = getSupabaseClient()
  const readingsToInsert = readings.map((r) => ({
    patient_id: patientId,
    value: r.value,
    unit: r.unit || 'mg/dL',
    timestamp_ms: new Date(r.timestamp).getTime(),
    source: r.source || 'CGM',
    created_at_ms: new Date().getTime(),
  }))

  const { data, error } = await client.from('glucose_readings').upsert(readingsToInsert)

  if (error) {
    throw new Error(`Failed to upsert glucose readings: ${error.message}`)
  }

  return data
}

export async function logEvent(patientId: string, event: string, metadata?: any) {
  const client = getSupabaseClient()
  const { error } = await client.from('app_logs').insert({
    patient_id: patientId,
    event,
    metadata: metadata || {},
  })

  if (error) {
    console.error(`Failed to log event: ${error.message}`)
  }
}
