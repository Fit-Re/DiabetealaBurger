import React, { ErrorInfo, ReactNode } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { Palette } from "../theme";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

interface FallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onRetry: () => void;
}

/**
 * La UI de respaldo vive en un componente función porque `ErrorBoundary` tiene
 * que ser una clase (getDerivedStateFromError/componentDidCatch) y las clases no
 * pueden usar hooks; así el tema sigue reaccionando al esquema de color.
 */
function ErrorFallback({ error, errorInfo, onRetry }: FallbackProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.errorBox}>
          <Text style={styles.title}>Algo salió mal</Text>
          <Text style={styles.message}>
            La aplicación encontró un error inesperado. Intenta nuevamente.
          </Text>

          {error && (
            <View style={styles.errorDetails}>
              <Text style={styles.errorLabel}>Error:</Text>
              <Text style={styles.errorText}>{error.toString()}</Text>
            </View>
          )}

          {errorInfo && (
            <View style={styles.errorDetails}>
              <Text style={styles.errorLabel}>Detalles:</Text>
              <Text style={styles.errorText}>{errorInfo.componentStack}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Pressable style={styles.button} onPress={onRetry}>
        <Text style={styles.buttonText}>Intentar de Nuevo</Text>
      </Pressable>
    </View>
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
      padding: 16,
    },
    errorBox: {
      backgroundColor: c.surface,
      borderRadius: 8,
      padding: 24,
      borderLeftWidth: 4,
      borderLeftColor: c.status.error.fg,
      marginBottom: 24,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: c.text,
      marginBottom: 8,
    },
    message: {
      fontSize: 16,
      color: c.textBody,
      marginBottom: 16,
      lineHeight: 24,
    },
    errorDetails: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    errorLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: c.textSecondary,
      textTransform: "uppercase",
      marginBottom: 8,
    },
    errorText: {
      fontSize: 12,
      color: c.textBody,
      fontFamily: "Courier New",
      lineHeight: 18,
    },
    button: {
      backgroundColor: c.accentBright,
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 8,
      marginBottom: 24,
      marginHorizontal: 16,
    },
    buttonText: {
      color: c.textOnAccent,
      fontSize: 16,
      fontWeight: "600",
      textAlign: "center",
    },
  });
