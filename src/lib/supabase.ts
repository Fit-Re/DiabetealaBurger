import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";

// Determinar si estamos en web
const isWeb = typeof window !== "undefined" && typeof document !== "undefined";

// Obtener el storage adapter correcto
let storage: any;
if (isWeb) {
  // En web, usar localStorage
  storage = {
    getItem: (key: string) => localStorage.getItem(key),
    setItem: (key: string, value: string) => localStorage.setItem(key, value),
    removeItem: (key: string) => localStorage.removeItem(key),
  };
} else {
  // En React Native, usar AsyncStorage
  const AsyncStorage = require("@react-native-async-storage/async-storage").default;
  storage = AsyncStorage;
}

// Obtener variables de entorno (inyectadas por script o proceso.env)
let supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
let supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

// Si estamos en web, intentar obtener de las globales inyectadas
if (isWeb) {
  const injectedUrl = (window as any).__EXPO_PUBLIC_SUPABASE_URL__;
  const injectedKey = (window as any).__EXPO_PUBLIC_SUPABASE_ANON_KEY__;

  if (injectedUrl) supabaseUrl = injectedUrl;
  if (injectedKey) supabaseAnonKey = injectedKey;

  console.log("Supabase Config:", {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    isWeb: true,
  });
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);
