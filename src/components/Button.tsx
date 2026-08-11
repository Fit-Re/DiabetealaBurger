import React, { useMemo } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  useColorScheme,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  MIN_TOUCH_TARGET,
} from "../theme";

export type ButtonVariant = "primary" | "secondary" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  style,
  testID,
}) => {
  const colorScheme = useColorScheme() ?? "light";

  const styles = useMemo(() => {
    const palette = colors[colorScheme];
    return StyleSheet.create({
      base: {
        borderRadius: borderRadius.md,
        alignItems: "center",
        justifyContent: "center",
        // Ningún tamaño baja del mínimo táctil accesible.
        minHeight: MIN_TOUCH_TARGET,
      },
      primary: { backgroundColor: palette.accent },
      secondary: { backgroundColor: palette.bgSecondary },
      outline: {
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: palette.accent,
      },
      sm: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
      md: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
      lg: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
      disabled: { opacity: 0.5 },
      primaryText: { ...typography.label, color: palette.textOnAccent },
      secondaryText: { ...typography.label, color: palette.text },
      outlineText: { ...typography.label, color: palette.accent },
    });
  }, [colorScheme]);

  const textStyle = {
    primary: styles.primaryText,
    secondary: styles.secondaryText,
    outline: styles.outlineText,
  }[variant];

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant],
        styles[size],
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      testID={testID}
    >
      <Text style={textStyle}>{label}</Text>
    </TouchableOpacity>
  );
};
