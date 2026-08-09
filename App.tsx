import React, { useEffect } from 'react'
import { useColorScheme, StyleSheet } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { StatusBar } from 'expo-status-bar'

// Screens
import { HomeScreen } from './src/screens/HomeScreen'
import { TrendsScreen } from './src/screens/TrendsScreen'
import { EvidenceScreen } from './src/screens/EvidenceScreen'
import { SettingsScreen } from './src/screens/SettingsScreen'

// Store & Theme
import { useAppStore } from './src/store'
import { colors } from './src/theme'

const Tab = createBottomTabNavigator()

const navigationTheme = (scheme: 'light' | 'dark') => {
  const palette = colors[scheme]
  return {
    dark: scheme === 'dark',
    colors: {
      primary: palette.accent,
      background: palette.bg,
      card: palette.bgSecondary,
      text: palette.text,
      border: palette.border,
      notification: palette.error,
    },
  }
}

const App: React.FC = () => {
  const systemColorScheme = useColorScheme() ?? 'light'
  const { userProfile, setUserProfile, colorScheme, isOnboarded, setIsOnboarded } = useAppStore()

  // Initialize with sample data on first load
  useEffect(() => {
    if (!userProfile && !isOnboarded) {
      // Set default user profile
      setUserProfile({
        id: '1',
        name: 'Usuario',
        diabetesType: 'T1D',
        glucoseRange: { min: 70, max: 180 },
        weight: 70,
        height: 175,
        insulinType: 'Rápida + Basal',
      })

      // Mark as onboarded (in real app, this would be based on actual onboarding completion)
      // setIsOnboarded(true)
    }
  }, [userProfile, isOnboarded, setUserProfile, setIsOnboarded])

  const effectiveColorScheme = colorScheme === 'auto' ? systemColorScheme : (colorScheme as 'light' | 'dark')

  return (
    <>
      <StatusBar barStyle={effectiveColorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      <NavigationContainer theme={navigationTheme(effectiveColorScheme)}>
        <Tab.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: colors[effectiveColorScheme].bgSecondary,
              borderBottomWidth: 1,
              borderBottomColor: colors[effectiveColorScheme].border,
            },
            headerTintColor: colors[effectiveColorScheme].text,
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 18,
            },
            tabBarStyle: {
              backgroundColor: colors[effectiveColorScheme].bgSecondary,
              borderTopWidth: 1,
              borderTopColor: colors[effectiveColorScheme].border,
              paddingBottom: 8,
              paddingTop: 8,
            },
            tabBarActiveTintColor: colors[effectiveColorScheme].accent,
            tabBarInactiveTintColor: colors[effectiveColorScheme].textSecondary,
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: '500',
              marginTop: 4,
            },
          }}
        >
          <Tab.Screen
            name="Home"
            component={HomeScreen}
            options={{
              title: 'Inicio',
              headerShown: false,
              tabBarLabel: 'Inicio',
              tabBarIcon: ({ color, size }) => <HomeTabIcon color={color} size={size} />,
            }}
          />

          <Tab.Screen
            name="Trends"
            component={TrendsScreen}
            options={{
              title: 'Tendencias',
              headerShown: false,
              tabBarLabel: 'Tendencias',
              tabBarIcon: ({ color, size }) => <TrendsTabIcon color={color} size={size} />,
            }}
          />

          <Tab.Screen
            name="Evidence"
            component={EvidenceScreen}
            options={{
              title: 'Evidencia',
              headerShown: false,
              tabBarLabel: 'Evidencia',
              tabBarIcon: ({ color, size }) => <EvidenceTabIcon color={color} size={size} />,
            }}
          />

          <Tab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              title: 'Configuración',
              headerShown: false,
              tabBarLabel: 'Ajustes',
              tabBarIcon: ({ color, size }) => <SettingsTabIcon color={color} size={size} />,
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </>
  )
}

// Tab Icons (SVG replacement with Unicode)
const HomeTabIcon = ({ color, size }: { color: string; size: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Text style={{ fontSize: 20, color }}>🏠</Text>
  </Svg>
)

const TrendsTabIcon = ({ color, size }: { color: string; size: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Text style={{ fontSize: 20, color }}>📈</Text>
  </Svg>
)

const EvidenceTabIcon = ({ color, size }: { color: string; size: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Text style={{ fontSize: 20, color }}>📚</Text>
  </Svg>
)

const SettingsTabIcon = ({ color, size }: { color: string; size: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Text style={{ fontSize: 20, color }}>⚙️</Text>
  </Svg>
)

// Placeholder Svg component since we're using text
const Svg = ({ children, ...props }: any) => children

export default App
