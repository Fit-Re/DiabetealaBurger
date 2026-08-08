import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from "react-native";

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
                color="#3b82f6"
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    backgroundColor: "#fff",
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
    color: "#1f2937",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  subtext: {
    fontSize: 12,
    color: "#9ca3af",
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
    backgroundColor: "#e5e7eb",
  },
  dismissButtonText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
  },
  retryButton: {
    backgroundColor: "#3b82f6",
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
