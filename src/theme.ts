// Tokens del sistema de diseño.
//
// `light` reproduce los hex que las pantallas tenían sueltos, salvo siete valores
// que eran tonos casi duplicados (gray-800 vs gray-900, emerald vs green) y se
// consolidaron en un solo token. Los siete consolidados suben el contraste, y uno
// pasa a cumplir WCAG AA (3.77:1 -> 5.02:1). `dark` es nuevo: no había tema oscuro.
import type { TextStyle, ViewStyle } from "react-native";

interface StatusTokens {
  /** Color de primer plano: iconos, texto de énfasis, barras. */
  fg: string;
  /** Variante de más contraste, para texto sobre `surface`. */
  strong: string;
  /** Fondo del badge o del bloque destacado. */
  surface: string;
  /** Fondo aún más tenue, para bloques grandes. */
  surfaceSubtle: string;
  /** Borde a juego con `surface`. */
  border: string;
}

interface Palette {
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  /** Fondo de superficies elevadas (tarjetas sobre bgSecondary). */
  surface: string;
  overlay: string;

  text: string;
  /** Texto corrido dentro de tarjetas; un paso por debajo de `text`. */
  textBody: string;
  textSecondary: string;
  textMuted: string;
  /** Texto sobre `accent` y sobre superficies de estado saturadas. */
  textOnAccent: string;

  border: string;
  borderStrong: string;

  /** Superficie de contraste invertido (botones "negros" del diseño original). */
  inverseSurface: string;
  onInverseSurface: string;

  accent: string;
  accentLight: string;
  accentBright: string;
  /** Realce translúcido del acento (selecciones, franjas de rango). */
  accentTranslucent: string;
  /** Fondo de vistas previas de foto: negro en ambos temas, a propósito. */
  photoBackdrop: string;

  success: string;
  error: string;
  warning: string;
  info: string;

  status: {
    success: StatusTokens;
    warning: StatusTokens;
    error: StatusTokens;
    info: StatusTokens;
  };

  shadow: string;
}

const light: Palette = {
  bg: "#ffffff",
  bgSecondary: "#f9fafb",
  bgTertiary: "#f3f4f6",
  surface: "#ffffff",
  overlay: "rgba(0, 0, 0, 0.5)",

  text: "#111827",
  textBody: "#374151",
  textSecondary: "#6b7280",
  textMuted: "#9ca3af",
  textOnAccent: "#ffffff",

  border: "#e5e7eb",
  borderStrong: "#d1d5db",

  inverseSurface: "#111827",
  onInverseSurface: "#ffffff",

  accent: "#2563eb",
  accentLight: "#dbeafe",
  accentBright: "#3b82f6",
  accentTranslucent: "rgba(37, 99, 235, 0.12)",
  photoBackdrop: "#000000",

  success: "#16a34a",
  error: "#dc2626",
  warning: "#d97706",
  info: "#0891b2",

  status: {
    success: {
      fg: "#16a34a",
      strong: "#15803d",
      surface: "#dcfce7",
      surfaceSubtle: "#f0fdf4",
      border: "#bbf7d0",
    },
    warning: {
      fg: "#d97706",
      strong: "#92400e",
      surface: "#fef3c7",
      surfaceSubtle: "#fffbeb",
      border: "#fde68a",
    },
    error: {
      fg: "#dc2626",
      strong: "#b91c1c",
      surface: "#fee2e2",
      surfaceSubtle: "#fef2f2",
      border: "#fecaca",
    },
    info: {
      fg: "#4f46e5",
      strong: "#4338ca",
      surface: "#eef2ff",
      surfaceSubtle: "#f5f7ff",
      border: "#c7d2fe",
    },
  },

  shadow: "#000000",
};

const dark: Palette = {
  // En claro las tarjetas (`surface`, blanco) resaltan sobre la página
  // (`bgSecondary`, gris muy claro). En oscuro hay que invertir la relación: la
  // página se hunde y la tarjeta se eleva. Si ambos comparten valor, las
  // tarjetas desaparecen contra el fondo.
  bg: "#111827",
  bgSecondary: "#0f172a",
  bgTertiary: "#374151",
  surface: "#1f2937",
  overlay: "rgba(0, 0, 0, 0.7)",

  text: "#f3f4f6",
  textBody: "#d1d5db",
  textSecondary: "#9ca3af",
  textMuted: "#6b7280",
  textOnAccent: "#ffffff",

  border: "#374151",
  borderStrong: "#4b5563",

  inverseSurface: "#e5e7eb",
  onInverseSurface: "#111827",

  accent: "#3b82f6",
  accentLight: "#1e3a8a",
  accentBright: "#60a5fa",
  accentTranslucent: "rgba(96, 165, 250, 0.18)",
  photoBackdrop: "#000000",

  success: "#22c55e",
  error: "#ef4444",
  warning: "#f59e0b",
  info: "#22d3ee",

  status: {
    success: {
      fg: "#22c55e",
      strong: "#86efac",
      surface: "#14532d",
      surfaceSubtle: "#0f2f1c",
      border: "#166534",
    },
    warning: {
      fg: "#f59e0b",
      strong: "#fcd34d",
      surface: "#4a2c07",
      surfaceSubtle: "#2f1d05",
      border: "#78350f",
    },
    error: {
      fg: "#ef4444",
      strong: "#fca5a5",
      surface: "#4c1d1d",
      surfaceSubtle: "#301111",
      border: "#7f1d1d",
    },
    info: {
      fg: "#818cf8",
      strong: "#c7d2fe",
      surface: "#312e81",
      surfaceSubtle: "#1e1b4b",
      border: "#4338ca",
    },
  },

  shadow: "#000000",
};

export const colors = { light, dark };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// `as const` es necesario: sin él fontWeight se infiere como string y deja de ser
// asignable a TextStyle.
export const typography = {
  h1: { fontSize: 32, fontWeight: "700", lineHeight: 40 },
  h2: { fontSize: 24, fontWeight: "700", lineHeight: 32 },
  h3: { fontSize: 20, fontWeight: "600", lineHeight: 28 },
  h4: { fontSize: 18, fontWeight: "600", lineHeight: 26 },
  body: { fontSize: 16, fontWeight: "400", lineHeight: 24 },
  bodyMd: { fontSize: 14, fontWeight: "400", lineHeight: 20 },
  bodySm: { fontSize: 12, fontWeight: "400", lineHeight: 16 },
  caption: { fontSize: 12, fontWeight: "500", lineHeight: 16 },
  label: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
} as const satisfies Record<string, TextStyle>;

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
} as const satisfies Record<string, ViewStyle>;

// Mínimo táctil accesible: 44pt en iOS, 48dp en Android (DESIGN_SYSTEM.md).
export const MIN_TOUCH_TARGET = 44;

export type ColorScheme = keyof typeof colors;
export type { Palette };
