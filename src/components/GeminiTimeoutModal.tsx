import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from "react-native";
import { useThemedStyles, usePalette } from "../hooks/useThemedStyles";
import type { Palette } from "../theme";

interface GeminiTimeoutModalProps {
  visible: boolean;
  isLoading: boolean;
  onRetry: () => void;
  onDismiss: () => void;
  elapsedSeconds: number;
}

export function GeminiTimeoutModal({
  visible,
  isLoading,
  onRetry,
  onDismiss,
  elapsedSeconds,
}: GeminiTimeoutModalProps) {
  const palette = usePalette();
  const styles = useThemedStyles(createStyles);
  const isTimeout = elapsedSeconds > 60;
  const isSlowConnection = elapsedSeconds > 30 && !isTimeout;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {isTimeout ? (
            <>
              <Text style={styles.title}>Gemini No Responde</Text>
              <Text style={styles.message}>
                La solicitud excedió los 60 segundos. Verifica tu conexión a
                internet e intenta nuevamente.
              </Text>

              <View style={styles.buttonRow}>
                <Pressable
                  style={[styles.button, styles.dismissButton]}
                  onPress={onDismiss}
                >
                  <Text style={styles.dismissButtonText}>Descartar</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, styles.retryButton]}
                  onPress={onRetry}
                >
                  <Text style={styles.retryButtonText}>Reintentar</Text>
                </Pressable>
              </View>
            </>
          ) : isSlowConnection ? (
            <>
              <ActivityIndicator
                size="large"
                color={palette.accentBright}
                style={styles.spinner}
              />
              <Text style={styles.title}>Gemini está lento</Text>
              <Text style={styles.message}>
                Esperando respuesta... {elapsedSeconds}s
              </Text>
              <Text style={styles.subtext}>
                Si toma más de 60s, será cancelado.
              </Text>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: "center",
      alignItems: "center",
    },
    container: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 24,
      width: "80%",
      maxWidth: 340,
      alignItems: "center",
    },
    spinner: {
      marginBottom: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: "600",
      color: c.text,
      marginBottom: 8,
      textAlign: "center",
    },
    message: {
      fontSize: 14,
      color: c.textBody,
      marginBottom: 8,
      textAlign: "center",
      lineHeight: 20,
    },
    subtext: {
      fontSize: 12,
      color: c.textMuted,
      textAlign: "center",
      marginBottom: 20,
    },
    buttonRow: {
      flexDirection: "row",
      gap: 12,
      width: "100%",
    },
    button: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
    },
    dismissButton: {
      backgroundColor: c.border,
    },
    dismissButtonText: {
      color: c.textBody,
      fontSize: 14,
      fontWeight: "600",
    },
    retryButton: {
      backgroundColor: c.accentBright,
    },
    retryButtonText: {
      color: c.textOnAccent,
      fontSize: 14,
      fontWeight: "600",
    },
  });
