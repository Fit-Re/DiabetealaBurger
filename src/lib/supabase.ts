import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// Obtener variables de entorno (inyectadas por script o proceso.env)
let supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
let supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

// Si estamos en web, intentar obtener de las globales inyectadas
if (typeof window !== "undefined") {
  const injectedUrl = (window as any).__EXPO_PUBLIC_SUPABASE_URL__;
  const injectedKey = (window as any).__EXPO_PUBLIC_SUPABASE_ANON_KEY__;

  if (injectedUrl) supabaseUrl = injectedUrl;
  if (injectedKey) supabaseAnonKey = injectedKey;

  console.log("Supabase Config:", {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
  });
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);
