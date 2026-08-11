import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { ThemedTextInput } from "../components/ThemedTextInput";
import { useAuth } from "../lib/auth";
import { useThemedStyles, usePalette } from "../hooks/useThemedStyles";
import type { Palette } from "../theme";

type AuthMode = "login" | "signup";

export default function LoginScreen() {
  const styles = useThemedStyles(createStyles);
  const palette = usePalette();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      setError("Ingresa tu email y contraseña.");
      return;
    }

    if (mode === "signup" && !confirmPassword) {
      setError("Confirma tu contraseña.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    let errorMessage: string | null = null;

    if (mode === "login") {
      errorMessage = await signIn(email.trim(), password);
      if (errorMessage) {
        setError(
          errorMessage.includes("Invalid login credentials")
            ? "Email o contraseña incorrectos."
            : errorMessage
        );
      }
    } else {
      errorMessage = await signUp(email.trim(), password, confirmPassword);
      if (errorMessage) {
        setError(errorMessage);
      } else {
        setSuccess(
          "¡Cuenta creada exitosamente! Por favor, verifica tu email antes de ingresar."
        );
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setTimeout(() => setMode("login"), 3000);
      }
    }

    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>GlucoTrack</Text>
        <Text style={styles.subtitle}>
          {mode === "login"
            ? "Ingresa con la cuenta que te dio tu equipo de diabetes."
            : "Crea una nueva cuenta para empezar a rastrear tu glucosa."}
        </Text>

        <ThemedTextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!loading}
        />
        <ThemedTextInput
          style={styles.input}
          placeholder="Contraseña"
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          editable={!loading}
        />

        {mode === "signup" && (
          <ThemedTextInput
            style={styles.input}
            placeholder="Confirmar contraseña"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            editable={!loading}
          />
        )}

        {error && <Text style={styles.error}>{error}</Text>}
        {success && <Text style={styles.success}>{success}</Text>}

        <Pressable
          style={[styles.button, loading && styles.disabled]}
          onPress={onSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={palette.textOnAccent} />
          ) : (
            <Text style={styles.buttonText}>
              {mode === "login" ? "Ingresar" : "Crear cuenta"}
            </Text>
          )}
        </Pressable>

        <Pressable
          style={styles.toggleMode}
          onPress={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
            setSuccess(null);
          }}
          disabled={loading}
        >
          <Text style={styles.toggleText}>
            {mode === "login"
              ? "¿No tenés cuenta? Crear una"
              : "¿Ya tenés cuenta? Ingresar"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bgSecondary,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      padding: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: c.text,
      textAlign: "center",
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      color: c.textSecondary,
      textAlign: "center",
      marginBottom: 32,
    },
    input: {
      backgroundColor: c.surface,
      borderRadius: 10,
      padding: 14,
      fontSize: 15,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 12,
    },
    error: {
      color: c.status.error.fg,
      fontSize: 13,
      textAlign: "center",
      marginBottom: 12,
    },
    success: {
      color: c.status.success.fg,
      fontSize: 13,
      textAlign: "center",
      marginBottom: 12,
    },
    button: {
      backgroundColor: c.accent,
      borderRadius: 12,
      padding: 14,
      alignItems: "center",
      marginTop: 4,
    },
    buttonText: { color: c.textOnAccent, fontSize: 15, fontWeight: "700" },
    disabled: { opacity: 0.6 },
    toggleMode: {
      marginTop: 20,
      padding: 12,
    },
    toggleText: {
      fontSize: 13,
      color: c.accent,
      textAlign: "center",
      fontWeight: "500",
    },
  });
