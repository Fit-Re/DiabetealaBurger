import React from "react";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import HomeScreen from "./src/screens/HomeScreen";
import RegistrarScreen from "./src/screens/RegistrarScreen";
import TrendsScreen from "./src/screens/TrendsScreen";
import EvidenceScreen from "./src/screens/EvidenceScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import LoginScreen from "./src/screens/LoginScreen";
import { AuthProvider, useAuth } from "./src/lib/auth";
import { ErrorBoundary } from "./src/components/ErrorBoundary";

const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{ headerTitleStyle: { fontWeight: "700" } }}>
        <Tab.Screen
          name="Inicio"
          component={HomeScreen}
          options={{ title: "GlucoTrack" }}
        />
        <Tab.Screen
          name="Registrar"
          component={RegistrarScreen}
          options={{ title: "Registrar" }}
        />
        <Tab.Screen
          name="Tendencias"
          component={TrendsScreen}
          options={{ title: "Tendencias" }}
        />
        <Tab.Screen
          name="Evidencia"
          component={EvidenceScreen}
          options={{ title: "Evidencia científica" }}
        />
        <Tab.Screen name="Ajustes" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return session ? <MainTabs /> : <LoginScreen />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
});
