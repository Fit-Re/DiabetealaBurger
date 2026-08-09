# DiabetealaBurger Design System

## Overview

DiabetealaBurger es una aplicación de autogestión de diabetes que sintetiza evidencia científica, proporciona insights personalizados y rastrea factores de estilo de vida. Este documento describe el sistema de diseño, componentes visuales y patrones de interfaz implementados en React Native.

**Documento base**: [Approved Designs](/Users/re/.claude/plans/quizzical-hatching-cookie.md)  
**Implementación**: React Native + Expo  
**Estado**: ✅ Production-ready  

---

## 1. Paleta de Colores

### Modo Claro
```
Fondo principal:      #ffffff
Fondo secundario:     #f9fafb
Texto primario:       #111827
Texto secundario:     #6b7280
Bordes:               #e5e7eb
Acento principal:     #2563eb
Acento claro:         #dbeafe
```

### Modo Oscuro
```
Fondo principal:      #111827
Fondo secundario:     #1f2937
Texto primario:       #f3f4f6
Texto secundario:     #9ca3af
Bordes:               #374151
Acento principal:     #2563eb (sin cambios)
Acento claro:         #1e40af
```

### Colores de Estado
```
Éxito (en rango):     #16a34a (verde)
Error (bajo):         #dc2626 (rojo)
Alerta (alto):        #d97706 (ámbar)
Información:          #0891b2 (cian)
```

### Aplicación de Colores
- **Lecturas de glucosa**:
  - Verde si está en rango (70-180 mg/dL)
  - Rojo si es baja (< 70)
  - Ámbar si es alta (> 180)
- **Badges de fortaleza de evidencia**:
  - Verde = Alta fortaleza
  - Ámbar = Media fortaleza
  - Rojo = Baja fortaleza
- **Estados interactivos**:
  - Hover = 80% opacidad
  - Active = Acento + sombra
  - Disabled = 50% opacidad + cursor not-allowed

---

## 2. Tipografía

### Escala de Fuentes
| Tipo | Tamaño | Peso | Alto de línea | Uso |
|------|--------|------|---------------|-----|
| h1 | 32px | 700 | 40px | Títulos principales |
| h2 | 24px | 700 | 32px | Títulos de sección |
| h3 | 20px | 600 | 28px | Subtítulos |
| h4 | 18px | 600 | 26px | Encabezados pequeños |
| body | 16px | 400 | 24px | Texto corporal |
| label | 14px | 600 | 20px | Etiquetas |
| bodySm | 12px | 400 | 16px | Texto pequeño |
| caption | 12px | 500 | 16px | Captions |

### Familia de Fuentes
- **Sistema nativo**: `-apple-system`, `Segoe UI` (React Native default)
- **Nota**: Las fuentes personalizadas se pueden agregar en `app.json` si es necesario

### Accesibilidad de Tipografía
- Mínimo de contraste WCAG AA (4.5:1 para texto normal, 3:1 para texto grande)
- Texto corporal nunca menor a 16px
- Alto de línea mínimo de 1.5x para legibilidad

---

## 3. Espaciado

### Escala Modular (Base 8px)
```
xs:   4px
sm:   8px
md:  16px (base)
lg:  24px
xl:  32px
xxl: 48px
```

### Aplicación de Espaciado
- **Padding interno**: md (16px) para la mayoría de contenedores
- **Gaps entre elementos**: sm (8px) para relacionados, md (16px) para distintos
- **Márgenes entre secciones**: lg (24px)
- **Márgenes horizontales**: md (16px) en viewport completo

### Altura Mínima de Elementos Interactivos
- Botones: 44px (iOS), 48px (Android)
- Campos de entrada: 44px
- Elementos clickeables: 44px mínimo

---

## 4. Border Radius

| Escala | Valor | Uso |
|--------|-------|-----|
| sm | 4px | Botones pequeños, elementos micro |
| md | 8px | Cards, inputs, botones |
| lg | 12px | Modales, paneles principales |
| xl | 16px | Splash, hero sections |
| full | 9999px | Avatares, badges redondas |

**Regla de jerarquía**: `inner_radius = outer_radius - gap`
- Contenedor exterior (lg/12px) + gap (8px) = interior (md/8px)

---

## 5. Sombras

### Elevaciones
```
sm (elev 2px):
  - Offset Y: 1px
  - Blur: 2px
  - Opacidad: 10%

md (elev 4px):
  - Offset Y: 2px
  - Blur: 4px
  - Opacidad: 15%

lg (elev 8px):
  - Offset Y: 4px
  - Blur: 8px
  - Opacidad: 20%
```

**Aplicación**:
- `sm`: Cards sin interacción
- `md`: Botones, inputs, cards interactivas
- `lg`: Modales, dropdowns, elementos flotantes

---

## 6. Componentes

### Card Component
**Ubicación**: `src/components/Card.tsx`

**Variantes**:
- **default**: Fondo secundario, sin borde
- **elevated**: Fondo secundario + sombra md
- **outlined**: Fondo primario + borde 1px

**Props**:
```typescript
interface CardProps {
  children: React.ReactNode
  variant?: 'default' | 'elevated' | 'outlined'
  style?: StyleProp<ViewStyle>
}
```

**Ejemplo**:
```tsx
<Card variant="elevated">
  <Text style={styles.cardTitle}>Glucosa Promedio</Text>
  <Text style={styles.cardValue}>142 mg/dL</Text>
</Card>
```

### Botones

**Primarios** (Acento azul):
- Usado para CTAs principales (registrar lectura, guardar)
- Relleno completo con texto blanco
- Padding: vertical sm (8px), horizontal md (16px)

**Secundarios** (Borde gris):
- Acciones menos importantes
- Borde 1px, sin relleno
- Hover: fondo gris 5%

**Deshabilitados**:
- Opacidad 50%
- cursor: not-allowed

### Inputs

**Campos de texto**:
- Altura: 44px mínimo
- Borde: 1px color frontera
- Padding: sm (8px) horizontal
- Focus: borde acento 2px, sin outline
- Placeholder: texto secundario 70%

**Validación**:
- Borde rojo en error
- Mensaje de error rojo debajo
- Success: icono verde (si aplica)

---

## 7. Pantallas Implementadas

### HomeScreen (B_Narrative_Flow)
**Propósito**: Dashboard principal con contexto narrativo

**Secciones**:
1. **Header**
   - Fecha prominente (8 de agosto)
   - Saludo personalizado ("Hola, Usuario")
   - Fondo secundario

2. **Summary Card**
   - Acento azul claro (background)
   - Borde izquierdo azul 4px
   - Mensaje de contexto ("Excelente: dentro del rango objetivo")

3. **Current Reading**
   - Lectura grande (142 mg/dL)
   - Color basado en estado (rojo/verde/ámbar)
   - Hace X tiempo (fecha-fns relativa)

4. **Time Range Selector**
   - 3 botones: 24h / 7 días / 30 días
   - Active: fondo acento azul + texto blanco
   - Inactive: borde gris + texto gris

5. **Statistics Grid**
   - 2 columnas
   - 4 cards: Promedio, En rango, Eventos bajos, Eventos altos
   - Valores grandes (h3), etiquetas pequeñas

6. **Insulin Timeline**
   - Últimos 5 eventos
   - Hora (HH:mm), tipo (Bolus/Basal), dosis (U)
   - Fondo secundario, borde izquierdo acento

7. **Detected Patterns**
   - Expandible al tap
   - Descripción, período, confianza (%)
   - Detalles ocultos, muestra al expandir

8. **Primary CTA**
   - "+ Registrar lectura"
   - Sticky en la parte inferior
   - Fondo acento, texto blanco, 44px altura

### SettingsScreen (B_One_Deep_Page)
**Propósito**: Configuración streamlined con jerarquía clara

**Secciones**:
1. **Profile**
   - Nombre (editable inline)
   - Tipo de diabetes
   - Rango de glucosa objetivo
   - Peso, altura
   - Tipo de insulina

2. **Integrations**
   - LibreLink (conectar FreeStyle Libre)
   - Ultrahuman (conectar ring + datos de salud)
   - Dexcom (conectar CGM)
   - Botones "Conectar" para cada uno

3. **Notifications**
   - Alertas de glucosa baja (< 70)
   - Alertas de glucosa alta (> 180)
   - Recordatorios de ejercicio
   - Toggles (switches) para cada uno

4. **Appearance**
   - Selector de tema: Claro / Oscuro / Automático

5. **About**
   - Número de versión
   - Links: Términos de Servicio, Política de Privacidad

**Diseño**:
- SIN cards decorativos (Android Material aesthetic)
- Jerarquía vía tipografía (h4 títulos de sección, body etiquetas)
- Divisores (border-top) entre secciones
- Edición inline con feedback visual

### EvidenceScreen (C_Evidence_Graph)
**Propósito**: Visualización relacional de papers conectados a patrones

**Secciones**:
1. **Header**
   - Título + descripción
   - "Investigaciones relevantes para tu gestión de diabetes"

2. **Pattern Connection**
   - Acento claro (fondo azul claro)
   - Muestra número de papers relacionados
   - Contexto: "Encontramos X artículos que se relacionan con tus patrones"

3. **Search**
   - Campo de búsqueda (buscar por título/autor)
   - Filtros de fortaleza: Todas / Alta / Media / Baja

4. **Papers List**
   - Card por paper
   - Título, autores, año, journal
   - Barra de relevancia (0-100%)
   - Badge de fortaleza (verde/ámbar/rojo)
   - Contador de citas
   - Expandible al tap para ver resumen + botón "Leer artículo completo"

### TrendsScreen (B_Timeline_Stats)
**Propósito**: Análisis temporal con insights accionables

**Secciones**:
1. **Time Range Selector**
   - Botones: 7 días / 30 días
   - Igual que HomeScreen

2. **Trend Indicator**
   - Card acento claro
   - Dirección: 📈 Mejorando / ➡️ Estable / 📉 Empeorando
   - Cambio: "X mg/dL disminución/aumento/sin cambios"

3. **Statistics Grid**
   - Promedio, En rango (%), Estabilidad (%), Eventos bajos
   - Igual que HomeScreen

4. **Trend Chart**
   - Gráfico de barras (últimos 14 días)
   - Altura = promedio diario de glucosa
   - Color = estado (rojo/verde/ámbar)
   - Números de día debajo

5. **Compliance Tracking**
   - "Cambios aplicados hoy"
   - 4 botones en grid:
     - ✓ Cumplí (verde)
     - ✗ No cumplí (rojo)
     - ✎ Lo cambié (azul)
     - 😊 Me sentí (morado)
   - Tappable, muestra estado seleccionado

---

## 8. Dark Mode

### Implementación
- Automático: Respeta `useColorScheme()` del sistema
- Manual: User puede seleccionar en Settings (Claro/Oscuro/Automático)
- Almacenado en Zustand store: `colorScheme` state

### Especificaciones
- **Texto en dark**: #f3f4f6 (off-white, no blanco puro)
- **Acento**: #2563eb (sin cambios entre modos)
- **Superficies**: Usa elevación (más oscuro = más elevado)
- **Contraste**: WCAG AA mínimo en ambos modos

### Colores de Estado en Dark
- Success: #16a34a (verde, sin cambios)
- Error: #dc2626 (rojo, sin cambios)
- Warning: #d97706 (ámbar, sin cambios)

---

## 9. Accesibilidad

### Touch Targets
- Mínimo 44px × 44px (iOS), 48px × 48px (Android)
- Todos los botones, inputs, elementos interactivos

### Contraste
- WCAG AA: 4.5:1 mínimo para texto normal
- WCAG AA: 3:1 mínimo para texto grande (18px+)
- Verificar en ambos modos (claro + oscuro)

### Color + Texto
- Nunca usar color SOLO para comunicar estado
- Siempre añadir texto, icono o patrón
- Ejemplo: Glucosa alta = color rojo + etiqueta "ALTA" + icono de alerta

### Focus States
- Focus ring visible (color acento)
- No remover outline sin reemplazo
- Importante para navegación con teclado

### ARIA + Accesibilidad
- Headings: h1 → h2 → h3 (no saltear niveles)
- Botones: etiquetas claras, no solo iconos
- Formularios: labels visibles (no placeholder-only)
- Lists: usar components semánticos

---

## 10. Patrones de Interacción

### Botones
**Tap feedback**:
- Animación opacity (80% al tap)
- Duración: 100ms
- Sin delay perceptible

**Estados**:
- Normal: opacidad 100%
- Tap: opacidad 80%
- Disabled: opacidad 50%

### Listas Expandibles
**Expandir/Colapsar**:
- Tap en fila = toggle expand
- Chevron rotation (90° → 0°)
- Duración: 200ms
- Sin fade, instant show/hide de contenido

### Scroll Behavior
- Momentum scroll habilitado (natural feel)
- ScrollView con showsVerticalScrollIndicator={false}
- Padding bottom para evitar content debajo del botón sticky

### Empty States
- Icono o ilustración
- Mensaje amigable
- Acción primaria clara (si aplica)
- Ejemplo: "No hay patrones detectados" + icono vacío + mensaje contextual

---

## 11. Responsive Behavior

### Breakpoints
- **Móvil**: 375px (iPhone SE, mínimo)
- **Tablet**: 768px+
- **Desktop**: 1024px+

### Comportamiento
- **Móvil**: Todas las pantallas en portrait
- **Tablet**: Mismo layout, con más whitespace
- No horizontal scroll en ningún viewport
- Reflow de contenido (no shrink)

### Componentes Responsivos
- Cards: Ancho completo en móvil, máx 600px en tablet/desktop
- Grids: 1 columna en móvil, 2+ en tablet
- Botones: Ancho completo en móvil, mín 150px en desktop

---

## 12. Guía de Uso para Desarrolladores

### Importar Tema y Componentes
```typescript
import { colors, spacing, typography, borderRadius, shadows } from '@/theme'
import { Card } from '@/components/Card'
import { useAppStore } from '@/store'
```

### Crear un Componente con Tema
```typescript
import { useColorScheme, StyleSheet } from 'react-native'
import { colors, spacing } from '@/theme'

export const MyComponent = () => {
  const colorScheme = useColorScheme() ?? 'light'
  const palette = colors[colorScheme]

  const styles = StyleSheet.create({
    container: {
      backgroundColor: palette.bg,
      padding: spacing.md,
    },
    text: {
      color: palette.text,
    },
  })

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Contenido</Text>
    </View>
  )
}
```

### Usar Dark Mode Programáticamente
```typescript
const { colorScheme, setColorScheme } = useAppStore()

// En un toggle:
setColorScheme(colorScheme === 'auto' ? 'light' : 'auto')
```

### Crear un Card Personalizado
```typescript
<Card variant="elevated">
  <Text style={styles.title}>Título</Text>
  <Text style={styles.body}>Contenido</Text>
</Card>
```

### Respetar Accesibilidad
```typescript
// ✅ Bien
<TouchableOpacity
  style={styles.button}
  accessibilityLabel="Guardar cambios"
  accessibilityRole="button"
>
  <Text>Guardar</Text>
</TouchableOpacity>

// ❌ Evitar
<TouchableOpacity style={styles.button}>
  <Icon name="save" />
</TouchableOpacity>
```

---

## 13. Checklist de Implementación

Antes de considerar una pantalla completa:

- [ ] Colores corretos (claro + oscuro)
- [ ] Tipografía escala correcta (tamaño + peso)
- [ ] Espaciado modular (md base, gaps sm/lg)
- [ ] Touch targets 44px+
- [ ] Contraste WCAG AA (verificado en ambos modos)
- [ ] Focus states visibles
- [ ] Labels/alt text en todos los elementos interactivos
- [ ] No horizontal scroll
- [ ] Empty states diseñados
- [ ] Modo oscuro funciona (sin hardcoded colors)
- [ ] Responsive en 375px, 768px, 1024px
- [ ] No layout shifts (estable durante load)

---

## 14. Recursos

- **Código**: `/src/theme.ts` (design tokens)
- **Componentes**: `/src/components/`
- **Pantallas**: `/src/screens/`
- **Arquitectura**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **README**: [README.md](README.md)
- **Diagrams**: `/diagrams/`

---

**Fecha de creación**: 2026-08-09  
**Estado**: ✅ Production-ready  
**Última actualización**: Implementación React Native completada  

Para cambios al design system, referirse a [CLAUDE.md](CLAUDE.md) sección "Skill routing".
