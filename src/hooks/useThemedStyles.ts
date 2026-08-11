import { useMemo } from "react";
import { useColorScheme } from "react-native";
import { colors, type Palette } from "../theme";

/** Paleta activa según el esquema de color del sistema. */
export function usePalette(): Palette {
  const scheme = useColorScheme() ?? "light";
  return colors[scheme];
}

/**
 * Construye una hoja de estilos dependiente de la paleta, memoizada por esquema.
 *
 * Las pantallas declaran `const createStyles = (c: Palette) => StyleSheet.create({...})`
 * a nivel de módulo y la consumen con `const styles = useThemedStyles(createStyles)`,
 * de modo que el objeto solo se recalcula al cambiar entre claro y oscuro.
 */
export function useThemedStyles<T>(factory: (palette: Palette) => T): T {
  const palette = usePalette();
  return useMemo(() => factory(palette), [factory, palette]);
}
