import React from 'react'
import { TouchableOpacity, Text, StyleSheet, useColorScheme, ViewStyle } from 'react-native'
import { colors, spacing, typography, borderRadius } from '../theme'

export type ButtonVariant = 'primary' | 'secondary' | 'outline'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  style?: ViewStyle
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  style,
}) => {
  const colorScheme = useColorScheme() ?? 'light'
  const palette = colors[colorScheme]

  const styles = StyleSheet.create({
    base: {
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primary: {
      backgroundColor: palette.accent,
    },
    secondary: {
      backgroundColor: palette.bgSecondary,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: palette.accent,
    },
    sm: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    md: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    lg: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
    },
    disabled: {
      opacity: 0.5,
    },
    primaryText: {
      ...typography.label,
      color: '#ffffff',
    },
    secondaryText: {
      ...typography.label,
      color: palette.text,
    },
    outlineText: {
      ...typography.label,
      color: palette.accent,
    },
  })

  const getTextStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.primaryText
      case 'secondary':
        return styles.secondaryText
      case 'outline':
        return styles.outlineText
    }
  }

  return (
    <TouchableOpacity
      style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'outline' && styles.outline,
        size === 'sm' && styles.sm,
        size === 'md' && styles.md,
        size === 'lg' && styles.lg,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={getTextStyle()}>{label}</Text>
    </TouchableOpacity>
  )
}
