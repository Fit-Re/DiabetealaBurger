import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import HomeScreen from "./src/screens/HomeScreen";
import AddReadingScreen from "./src/screens/AddReadingScreen";
import ImportScreenshotScreen from "./src/screens/ImportScreenshotScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import { initDatabase } from "./src/db/database";

const Tab = createBottomTabNavigator();

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initDatabase()
      .then(() => setReady(true))
      .catch((e) => setError(e?.message ?? "Error al iniciar la base de datos"));
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator screenOptions={{ headerTitleStyle: { fontWeight: "700" } }}>
          <Tab.Screen
            name="Inicio"
            component={HomeScreen}
            options={{ title: "GlucoTrack" }}
          />
          <Tab.Screen
            name="Agregar"
            component={AddReadingScreen}
            options={{ title: "Registrar manual" }}
          />
          <Tab.Screen
            name="Importar"
            component={ImportScreenshotScreen}
            options={{ title: "Importar LibreLink" }}
          />
          <Tab.Screen
            name="Ajustes"
            component={SettingsScreen}
          />
        </Tab.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorText: { color: "#dc2626", textAlign: "center" },
});
