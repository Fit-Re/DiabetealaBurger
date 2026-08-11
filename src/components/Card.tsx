import React, { useMemo } from "react";
import {
  View,
  StyleSheet,
  useColorScheme,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, spacing, shadows, borderRadius } from "../theme";

export type CardVariant = "default" | "elevated" | "outlined";

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = "default",
  style,
  testID,
}) => {
  const colorScheme = useColorScheme() ?? "light";

  const styles = useMemo(() => {
    const palette = colors[colorScheme];
    return StyleSheet.create({
      card: {
        backgroundColor: variant === "outlined" ? palette.bg : palette.bgSecondary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: variant === "outlined" ? 1 : 0,
        borderColor: variant === "outlined" ? palette.border : "transparent",
        ...(variant === "elevated" ? shadows.md : null),
      },
    });
  }, [colorScheme, variant]);

  return (
    <View style={[styles.card, style]} testID={testID}>
      {children}
    </View>
  );
};
