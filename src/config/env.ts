export const config = {
  supabaseUrl: typeof window !== 'undefined' && (window as any).__SUPABASE_URL__
    ? (window as any).__SUPABASE_URL__
    : process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: typeof window !== 'undefined' && (window as any).__SUPABASE_ANON_KEY__
    ? (window as any).__SUPABASE_ANON_KEY__
    : process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
};
