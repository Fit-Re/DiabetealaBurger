import React from 'react'
import { View, StyleSheet, useColorScheme } from 'react-native'
import { colors, spacing, shadows, borderRadius } from '../theme'

interface CardProps {
  children: React.ReactNode
  variant?: 'default' | 'elevated' | 'outlined'
  style?: any
}

export const Card: React.FC<CardProps> = ({ children, variant = 'default', style }) => {
  const colorScheme = useColorScheme() ?? 'light'
  const palette = colors[colorScheme]

  const styles = StyleSheet.create({
    card: {
      backgroundColor: variant === 'outlined' ? palette.bg : palette.bgSecondary,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      borderWidth: variant === 'outlined' ? 1 : 0,
      borderColor: variant === 'outlined' ? palette.border : 'transparent',
      ...(variant === 'elevated' && shadows.md),
    },
  })

  return <View style={[styles.card, style]}>{children}</View>
}
