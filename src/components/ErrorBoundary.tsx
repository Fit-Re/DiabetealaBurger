import React, { ErrorInfo, ReactNode } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";

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
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.errorBox}>
              <Text style={styles.title}>Algo salió mal</Text>
              <Text style={styles.message}>
                La aplicación encontró un error inesperado. Intenta nuevamente.
              </Text>

              {this.state.error && (
                <View style={styles.errorDetails}>
                  <Text style={styles.errorLabel}>Error:</Text>
                  <Text style={styles.errorText}>
                    {this.state.error.toString()}
                  </Text>
                </View>
              )}

              {this.state.errorInfo && (
                <View style={styles.errorDetails}>
                  <Text style={styles.errorLabel}>Detalles:</Text>
                  <Text style={styles.errorText}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          <Pressable style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Intentar de Nuevo</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 16,
  },
  errorBox: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 24,
    borderLeftWidth: 4,
    borderLeftColor: "#dc2626",
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: "#4b5563",
    marginBottom: 16,
    lineHeight: 24,
  },
  errorDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  errorLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: "#374151",
    fontFamily: "Courier New",
    lineHeight: 18,
  },
  button: {
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 24,
    marginHorizontal: 16,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
