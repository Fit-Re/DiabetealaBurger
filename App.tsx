import React from "react";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import HomeScreen from "./src/screens/HomeScreen";
import GlucoseScreen from "./src/screens/GlucoseScreen";
import MedicationsScreen from "./src/screens/MedicationsScreen";
import MealsScreen from "./src/screens/MealsScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import LoginScreen from "./src/screens/LoginScreen";
import { AuthProvider, useAuth } from "./src/lib/auth";

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
          name="Glucosa"
          component={GlucoseScreen}
          options={{ title: "Registrar glucosa" }}
        />
        <Tab.Screen
          name="Medicamentos"
          component={MedicationsScreen}
          options={{ title: "Medicamentos" }}
        />
        <Tab.Screen
          name="Comida"
          component={MealsScreen}
          options={{ title: "Comida" }}
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
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
});
