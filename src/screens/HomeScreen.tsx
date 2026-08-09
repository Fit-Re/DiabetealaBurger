import React, { useState, useMemo } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  Pressable,
  Dimensions,
} from 'react-native'
import { useAppStore } from '../store'
import { colors, spacing, typography, borderRadius, shadows } from '../theme'
import { Card } from '../components/Card'
import { formatDistanceToNow, format, parseISO, startOfDay, endOfDay } from 'date-fns'

export const HomeScreen: React.FC = () => {
  const colorScheme = useColorScheme() ?? 'light'
  const palette = colors[colorScheme]
  const [selectedTimeRange, setSelectedTimeRange] = useState<'24h' | '7d' | '30d'>('24h')
  const [expandedPattern, setExpandedPattern] = useState<string | null>(null)

  const { readings, insulinEvents, patterns, userProfile } = useAppStore()

  // Get latest reading
  const currentReading = useMemo(() => readings[0], [readings])

  // Get today's readings
  const today = new Date()
  const todayReadings = useMemo(
    () =>
      readings.filter((r) => {
        const readDate = new Date(r.timestamp)
        return readDate >= startOfDay(today) && readDate <= endOfDay(today)
      }),
    [readings]
  )

  // Calculate statistics
  const stats = useMemo(() => {
    const relevantReadings =
      selectedTimeRange === '24h'
        ? todayReadings
        : selectedTimeRange === '7d'
          ? readings.slice(0, 168) // roughly 7 days of hourly reads
          : readings.slice(0, 720) // roughly 30 days

    if (relevantReadings.length === 0) {
      return { average: 0, inRange: 0, lowEvents: 0, highEvents: 0, timeInRange: 0 }
    }

    const min = userProfile?.glucoseRange.min ?? 70
    const max = userProfile?.glucoseRange.max ?? 180

    const average = relevantReadings.reduce((sum, r) => sum + r.value, 0) / relevantReadings.length
    const inRangeReadings = relevantReadings.filter((r) => r.value >= min && r.value <= max)
    const timeInRange = (inRangeReadings.length / relevantReadings.length) * 100
    const lowEvents = relevantReadings.filter((r) => r.value < 70).length
    const highEvents = relevantReadings.filter((r) => r.value > 180).length

    return { average: Math.round(average), inRange: Math.round(timeInRange), lowEvents, highEvents, timeInRange }
  }, [selectedTimeRange, readings, userProfile])

  const getStatusColor = (value: number) => {
    if (!userProfile) return palette.textSecondary
    const min = userProfile.glucoseRange.min
    const max = userProfile.glucoseRange.max
    if (value < 70) return colors[colorScheme as 'light' | 'dark'].error
    if (value >= min && value <= max) return colors[colorScheme as 'light' | 'dark'].success
    if (value > 180) return colors[colorScheme as 'light' | 'dark'].warning
    return palette.text
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.bg,
    },
    scrollContent: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xl,
    },
    header: {
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
      backgroundColor: palette.bgSecondary,
      marginHorizontal: -spacing.md,
      marginTop: -spacing.md,
      marginBottom: spacing.lg,
    },
    date: {
      ...typography.bodySm,
      color: palette.textSecondary,
      marginBottom: spacing.xs,
    },
    greeting: {
      ...typography.h2,
      color: palette.text,
    },
    summaryCard: {
      backgroundColor: palette.accentLight,
      borderLeftWidth: 4,
      borderLeftColor: palette.accent,
      marginBottom: spacing.lg,
    },
    summaryText: {
      ...typography.bodyMd,
      color: palette.text,
    },
    readingContainer: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    readingLabel: {
      ...typography.bodySm,
      color: palette.textSecondary,
      marginBottom: spacing.sm,
    },
    readingValue: {
      fontSize: 56,
      fontWeight: '700',
      color: currentReading ? getStatusColor(currentReading.value) : palette.text,
    },
    readingUnit: {
      ...typography.body,
      color: palette.textSecondary,
    },
    readingMeta: {
      ...typography.bodySm,
      color: palette.textSecondary,
      marginTop: spacing.sm,
    },
    timeRangeButtons: {
      flexDirection: 'row',
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    timeRangeButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: palette.border,
    },
    timeRangeButtonActive: {
      backgroundColor: palette.accent,
      borderColor: palette.accent,
    },
    timeRangeButtonText: {
      ...typography.label,
      color: palette.text,
    },
    timeRangeButtonTextActive: {
      color: '#ffffff',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    statCard: {
      flex: 1,
      minWidth: '45%',
      padding: spacing.md,
      backgroundColor: palette.bgSecondary,
      borderRadius: borderRadius.lg,
    },
    statValue: {
      ...typography.h3,
      color: palette.text,
      marginBottom: spacing.xs,
    },
    statLabel: {
      ...typography.bodySm,
      color: palette.textSecondary,
    },
    insulinTimeline: {
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      ...typography.h3,
      color: palette.text,
      marginBottom: spacing.md,
      marginTop: spacing.lg,
    },
    insulinEvent: {
      flexDirection: 'row',
      padding: spacing.md,
      backgroundColor: palette.bgSecondary,
      borderRadius: borderRadius.md,
      marginBottom: spacing.sm,
      alignItems: 'center',
    },
    insulinTime: {
      ...typography.label,
      color: palette.text,
      minWidth: 60,
    },
    insulinDose: {
      flex: 1,
      marginLeft: spacing.md,
    },
    insulinType: {
      ...typography.bodySm,
      color: palette.textSecondary,
    },
    insulinDoseValue: {
      ...typography.label,
      color: palette.accent,
    },
    patternItem: {
      padding: spacing.md,
      backgroundColor: palette.bgSecondary,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.sm,
      borderLeftWidth: 4,
      borderLeftColor: palette.info,
    },
    patternHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    patternTitle: {
      ...typography.label,
      color: palette.text,
      flex: 1,
    },
    patternConfidence: {
      ...typography.bodySm,
      color: palette.textSecondary,
    },
    patternDetails: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: palette.border,
    },
    patternDetailText: {
      ...typography.bodySm,
      color: palette.textSecondary,
      marginBottom: spacing.sm,
    },
    cta: {
      position: 'absolute',
      bottom: spacing.lg,
      left: spacing.md,
      right: spacing.md,
      backgroundColor: palette.accent,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
    },
    ctaText: {
      ...typography.label,
      color: '#ffffff',
    },
  })

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.date}>{format(today, 'd MMMM yyyy', { locale: {} })}</Text>
        <Text style={styles.greeting}>Hola, {userProfile?.name ?? 'Usuario'}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollIndicatorInsets={{ right: 1 }}
      >
        {/* Summary Card */}
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryText}>
            {currentReading && currentReading.value >= 70 && currentReading.value <= 180
              ? 'Excelente: dentro del rango objetivo'
              : 'Atención requerida'}
          </Text>
        </Card>

        {/* Current Reading */}
        {currentReading && (
          <View style={styles.readingContainer}>
            <Text style={styles.readingLabel}>Lectura actual</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={styles.readingValue}>{currentReading.value}</Text>
              <Text style={styles.readingUnit}> mg/dL</Text>
            </View>
            <Text style={styles.readingMeta}>
              hace {formatDistanceToNow(new Date(currentReading.timestamp))}
            </Text>
          </View>
        )}

        {/* Time Range Selector */}
        <View style={styles.timeRangeButtons}>
          {(['24h', '7d', '30d'] as const).map((range) => (
            <TouchableOpacity
              key={range}
              style={[styles.timeRangeButton, selectedTimeRange === range && styles.timeRangeButtonActive]}
              onPress={() => setSelectedTimeRange(range)}
            >
              <Text
                style={[
                  styles.timeRangeButtonText,
                  selectedTimeRange === range && styles.timeRangeButtonTextActive,
                ]}
              >
                {range === '24h' ? '24h' : range === '7d' ? '7 días' : '30 días'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Statistics Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.average}</Text>
            <Text style={styles.statLabel}>Promedio</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.inRange}%</Text>
            <Text style={styles.statLabel}>En rango</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.lowEvents}</Text>
            <Text style={styles.statLabel}>Eventos bajos</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.highEvents}</Text>
            <Text style={styles.statLabel}>Eventos altos</Text>
          </View>
        </View>

        {/* Insulin Timeline */}
        {insulinEvents.length > 0 && (
          <View style={styles.insulinTimeline}>
            <Text style={styles.sectionTitle}>Timeline de insulina</Text>
            {insulinEvents.slice(0, 5).map((event) => (
              <View key={event.id} style={styles.insulinEvent}>
                <Text style={styles.insulinTime}>{format(new Date(event.timestamp), 'HH:mm')}</Text>
                <View style={styles.insulinDose}>
                  <Text style={styles.insulinType}>{event.type === 'bolus' ? 'Bolus' : 'Basal'}</Text>
                  <Text style={styles.insulinDoseValue}>{event.dosage} U</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Detected Patterns */}
        {patterns.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Patrones detectados</Text>
            {patterns.map((pattern) => (
              <Pressable
                key={pattern.id}
                style={styles.patternItem}
                onPress={() => setExpandedPattern(expandedPattern === pattern.id ? null : pattern.id)}
              >
                <View style={styles.patternHeader}>
                  <Text style={styles.patternTitle}>{pattern.description}</Text>
                  <Text style={styles.patternConfidence}>{Math.round(pattern.confidence * 100)}%</Text>
                </View>
                {expandedPattern === pattern.id && (
                  <View style={styles.patternDetails}>
                    <Text style={styles.patternDetailText}>
                      Período: {pattern.timePeriod}
                    </Text>
                    <Text style={styles.patternDetailText}>
                      Lecturas afectadas: {pattern.affectedReadings}
                    </Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}

        {/* Bottom padding for CTA */}
        <View style={{ height: spacing.xl * 2 }} />
      </ScrollView>

      {/* Primary CTA */}
      <TouchableOpacity style={styles.cta} activeOpacity={0.8}>
        <Text style={styles.ctaText}>+ Registrar lectura</Text>
      </TouchableOpacity>
    </View>
  )
}
