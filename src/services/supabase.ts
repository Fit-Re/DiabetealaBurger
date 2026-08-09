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

async function getAuthenticatedUserId(): Promise<string> {
  const user = await getCurrentUser()
  if (!user?.id) {
    throw new Error('User not authenticated')
  }
  return user.id
}

function validateUserAccess(requestedPatientId: string, authenticatedUserId: string): void {
  if (requestedPatientId !== authenticatedUserId) {
    throw new Error('Unauthorized: Cannot access data for another patient')
  }
}

export async function signInWithEmail(email: string, password: string) {
  const client = getSupabaseClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) {
    throw new Error(`Authentication failed: Invalid credentials`)
  }
  return data
}

export async function signOut() {
  const client = getSupabaseClient()
  const { error } = await client.auth.signOut()
  if (error) {
    throw new Error(`Sign out failed: ${error.message}`)
  }
}

interface GlucoseReading {
  id: string
  patient_id: string
  value: number
  unit: string
  timestamp_ms: number
  source: string
  created_at_ms: number
}

export async function fetchGlucoseReadings(patientId: string): Promise<GlucoseReading[]> {
  const authenticatedUserId = await getAuthenticatedUserId()
  validateUserAccess(patientId, authenticatedUserId)

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

  return (data as GlucoseReading[]) || []
}

interface ReadingInput {
  value: number
  unit?: string
  timestamp: number | Date
  source?: string
}

export async function upsertGlucoseReadings(patientId: string, readings: ReadingInput[]): Promise<GlucoseReading[] | null> {
  const authenticatedUserId = await getAuthenticatedUserId()
  validateUserAccess(patientId, authenticatedUserId)

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

  return data as GlucoseReading[] | null
}

export async function logEvent(patientId: string, event: string, metadata?: Record<string, unknown>): Promise<void> {
  const authenticatedUserId = await getAuthenticatedUserId()
  validateUserAccess(patientId, authenticatedUserId)

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
