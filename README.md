# DiabetealaBurger

A diabetes self-management app that synthesizes evidence, provides personalized insights, and tracks lifestyle factors. Built with React Native/Expo.

## ✨ Features

### Home Screen (B_Narrative_Flow)
- Large current glucose reading with status indicator (mg/dL)
- 24h interactive glucose + insulin graph
- Summary card with narrative context ("Excelente: dentro del rango objetivo")
- Time-range selector (24h / 7d / 30d)
- Aggregated KPIs: Average, Time-in-Range, Low Events, Stability
- Insulin timeline with event tracking
- Expandable pattern detection
- Primary CTA: "+ Registrar lectura"

### Settings Screen (B_One_Deep_Page)
- Streamlined single-page layout (Android Material aesthetic)
- **Profile**: Name, diabetes type, glucose range, weight, height
- **Integrations**: LibreLink, Ultrahuman, Dexcom
- **Notifications**: Alerts for lows, highs, exercise reminders
- **Appearance**: Light / Dark / Auto theme
- **About**: Version, T&C, Privacy Policy

### Evidence Screen (C_Evidence_Graph)
- Relational visualization: Your patterns → Research papers
- Mock research database with:
  - Evidence strength badges (High/Medium/Low)
  - Relevance scoring (0-100%)
  - Citation counts
  - Expandable summaries
- Search & filter by title/author/strength
- Shows which papers relate to your detected patterns

### Trends Screen (B_Timeline_Stats)
- Time range selector (7d / 30d)
- Trend indicator (Improving 📈 / Stable ➡️ / Worsening 📉)
- Statistics grid: Average, In-Range %, Stability
- Visual trend chart with daily bars
- Compliance tracking: Cumplí ✓ / No cumplí ✗ / Lo cambié ✎ / Me sentí 😊

## 🛠️ Tech Stack

- **Framework**: React Native + Expo
- **Language**: TypeScript
- **Navigation**: React Navigation (Bottom Tabs)
- **State Management**: Zustand
- **Styling**: React Native StyleSheet + CSS variables
- **Date Utilities**: date-fns
- **i18n**: Spanish (user-facing labels in Spanish)

## 📁 Project Structure

```
.
├── App.tsx                 # Main app with navigation setup
├── app.json                # Expo configuration
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
│
├── src/
│   ├── screens/
│   │   ├── HomeScreen.tsx       # Dashboard with glucose + patterns
│   │   ├── TrendsScreen.tsx      # 7d/30d analytics
│   │   ├── EvidenceScreen.tsx    # Research papers + relevance
│   │   └── SettingsScreen.tsx    # Profile + integrations
│   ├── components/
│   │   └── Card.tsx             # Reusable card component
│   ├── store.ts            # Zustand state (readings, insulin, patterns)
│   └── theme.ts            # Design tokens (colors, spacing, typography)
│
└── .gitignore              # Git ignore rules
```

## 🎨 Design System

### Colors
**Light Mode:**
- Background: `#ffffff`
- Secondary BG: `#f9fafb`
- Text: `#111827`
- Text Secondary: `#6b7280`
- Accent: `#2563eb`
- Success: `#16a34a`
- Error: `#dc2626`
- Warning: `#d97706`

**Dark Mode:**
- Background: `#111827`
- Secondary BG: `#1f2937`
- Text: `#f3f4f6`
- Text Secondary: `#9ca3af`
- (Accent & status colors unchanged)

### Spacing
- `xs`: 4px
- `sm`: 8px
- `md`: 16px (base)
- `lg`: 24px
- `xl`: 32px
- `xxl`: 48px

### Typography
- `h1`: 32px, 700, 40px line-height
- `h2`: 24px, 700, 32px line-height
- `h3`: 20px, 600, 28px line-height
- `h4`: 18px, 600, 26px line-height
- `body`: 16px, 400, 24px line-height
- `label`: 14px, 600, 20px line-height
- `bodySm`: 12px, 400, 16px line-height

### Accessibility
- Minimum touch target: 44px (iOS), 48px (Android)
- Color + text (no color-only indicators)
- Contrast: WCAG AA (4.5:1 for normal, 3:1 for large)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- iOS/Android simulator or physical device

### Installation

```bash
# Install dependencies
npm install

# Start Expo dev server
npm start

# For iOS
npm run ios

# For Android
npm run android

# For web preview
npm run web
```

### Environment Setup

Create `.env` if using integrations:
```env
LIBRELINK_API_KEY=your_api_key
ULTRAHUMAN_API_KEY=your_api_key
DEXCOM_API_KEY=your_api_key
```

## 📊 Data Model

### GlucoseReading
```typescript
{
  id: string
  timestamp: Date
  value: number (mg/dL or mmol/L)
  unit: 'mg/dL' | 'mmol/L'
  source: 'CGM' | 'manual' | 'meter'
}
```

### InsulinEvent
```typescript
{
  id: string
  timestamp: Date
  type: 'bolus' | 'basal'
  dosage: number (U)
  unit: 'U'
  notes?: string
}
```

### PatternDetected
```typescript
{
  id: string
  description: string
  timePeriod: string
  affectedReadings: number
  confidence: number (0-1)
}
```

### UserProfile
```typescript
{
  id: string
  name: string
  diabetesType: 'T1D' | 'T2D' | 'gestational' | 'other'
  glucoseRange: { min: 70, max: 180 }
  weight: number
  height: number
  insulinType: string
}
```

## 🌙 Dark Mode

The app automatically respects system color scheme via `useColorScheme()`. To manually override:

```typescript
const { colorScheme, setColorScheme } = useAppStore()
setColorScheme('light' | 'dark' | 'auto')
```

All components use `colors[colorScheme]` palette for theme-aware rendering.

## 🧪 Testing

```bash
# Run TypeScript type checking
npm run type-check

# Run tests (when configured)
npm run test
```

## 📱 Responsive Breakpoints

- **Mobile**: 375px (iPhone SE, minimum)
- **Tablet**: 768px
- **Desktop**: 1024px / 1440px

All screens are portrait-oriented and mobile-first.

## 🔐 Security & Privacy

- **No external credential storage**: API keys in .env (not committed)
- **Local-first data**: Readings stored in Zustand (consider persisting to secure storage)
- **HTTPS only**: All API calls use HTTPS
- **GDPR-ready**: Personal data handled per privacy policy

## 📝 Next Steps

- [ ] Implement Onboarding flow (6 screens)
- [ ] Wire up LibreLink, Ultrahuman, Dexcom APIs
- [ ] Add real data persistence (AsyncStorage → Supabase)
- [ ] Implement pattern detection ML
- [ ] Add user testing with 3-5 T1D patients
- [ ] Performance optimization (skeleton loaders, lazy loading)
- [ ] CI/CD pipeline setup

## 📖 Learn More

- [React Native Docs](https://reactnative.dev)
- [Expo Docs](https://docs.expo.dev)
- [React Navigation](https://reactnavigation.org)
- [Zustand](https://github.com/pmndrs/zustand)

## 👤 Author

Regina (Randall Galloway) - DiabetealaBurger  
Pair Programming with Claude Code (Haiku 4.5)

## 📄 License

Proprietary - All rights reserved
