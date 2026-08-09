export const config = {
  supabaseUrl:
    typeof window !== 'undefined'
      ? ((window as any).__EXPO_PUBLIC_SUPABASE_URL__ || process.env.EXPO_PUBLIC_SUPABASE_URL || '')
      : process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey:
    typeof window !== 'undefined'
      ? ((window as any).__EXPO_PUBLIC_SUPABASE_ANON_KEY__ || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '')
      : process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
};
