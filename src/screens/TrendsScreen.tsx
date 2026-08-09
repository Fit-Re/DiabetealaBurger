import React, { useState, useMemo } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  Dimensions,
} from 'react-native'
import { useAppStore } from '../store'
import { colors, spacing, typography, borderRadius, shadows } from '../theme'
import { Card } from '../components/Card'
import { subDays, format, startOfDay, endOfDay } from 'date-fns'

interface DailyStats {
  date: Date
  average: number
  min: number
  max: number
  inRange: number
  lowEvents: number
  highEvents: number
}

interface ComplianceLog {
  date: Date
  status: 'met' | 'missed' | 'changed' | 'felt'
  notes?: string
}

export const TrendsScreen: React.FC = () => {
  const colorScheme = useColorScheme() ?? 'light'
  const palette = colors[colorScheme]
  const [timeRange, setTimeRange] = useState<'7d' | '30d'>('7d')
  const [complianceLogs, setComplianceLogs] = useState<ComplianceLog[]>([])

  const { readings, userProfile } = useAppStore()

  // Calculate daily statistics
  const dailyStats = useMemo(() => {
    const days = timeRange === '7d' ? 7 : 30
    const stats: DailyStats[] = []

    for (let i = 0; i < days; i++) {
      const date = subDays(new Date(), i)
      const dayStart = startOfDay(date)
      const dayEnd = endOfDay(date)

      const dayReadings = readings.filter((r) => {
        const readDate = new Date(r.timestamp)
        return readDate >= dayStart && readDate <= dayEnd
      })

      if (dayReadings.length > 0) {
        const min = userProfile?.glucoseRange.min ?? 70
        const max = userProfile?.glucoseRange.max ?? 180

        const values = dayReadings.map((r) => r.value)
        const average = values.reduce((a, b) => a + b, 0) / values.length
        const inRangeCount = values.filter((v) => v >= min && v <= max).length
        const inRangePercent = (inRangeCount / values.length) * 100

        stats.push({
          date,
          average: Math.round(average),
          min: Math.min(...values),
          max: Math.max(...values),
          inRange: Math.round(inRangePercent),
          lowEvents: values.filter((v) => v < 70).length,
          highEvents: values.filter((v) => v > 180).length,
        })
      }
    }

    return stats.reverse()
  }, [readings, timeRange, userProfile])

  // Calculate trend
  const trend = useMemo(() => {
    if (dailyStats.length < 2) return null
    const firstHalf = dailyStats.slice(0, Math.floor(dailyStats.length / 2))
    const secondHalf = dailyStats.slice(Math.floor(dailyStats.length / 2))

    const firstAvg = firstHalf.reduce((sum, s) => sum + s.average, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((sum, s) => sum + s.average, 0) / secondHalf.length

    return {
      direction: secondAvg < firstAvg ? 'mejora' : secondAvg > firstAvg ? 'empeora' : 'estable',
      change: Math.abs(Math.round(secondAvg - firstAvg)),
    }
  }, [dailyStats])

  // Aggregate stats
  const stats = useMemo(() => {
    if (dailyStats.length === 0) {
      return { average: 0, inRange: 0, lowEvents: 0, highEvents: 0, stability: 0 }
    }

    const values = dailyStats.flatMap((d) => [d.average])
    const average = Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    const inRange = Math.round(dailyStats.reduce((sum, d) => sum + d.inRange, 0) / dailyStats.length)
    const lowEvents = dailyStats.reduce((sum, d) => sum + d.lowEvents, 0)
    const highEvents = dailyStats.reduce((sum, d) => sum + d.highEvents, 0)

    // Stability = coefficient of variation
    const variance = values.reduce((sum, v) => sum + Math.pow(v - average, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)
    const stability = Math.round(100 - (stdDev / average) * 100)

    return { average, inRange, lowEvents, highEvents, stability: Math.max(0, stability) }
  }, [dailyStats])

  const toggleCompliance = (date: Date, status: 'met' | 'missed' | 'changed' | 'felt') => {
    const existingLog = complianceLogs.find((log) => format(log.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'))
    if (existingLog && existingLog.status === status) {
      setComplianceLogs(complianceLogs.filter((log) => log !== existingLog))
    } else {
      setComplianceLogs([
        ...complianceLogs.filter(
          (log) => format(log.date, 'yyyy-MM-dd') !== format(date, 'yyyy-MM-dd')
        ),
        { date, status },
      ])
    }
  }

  const getComplianceStatus = (date: Date) => {
    return complianceLogs.find((log) => format(log.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'))?.status
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.bg,
    },
    content: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.lg,
    },
    header: {
      marginBottom: spacing.lg,
    },
    title: {
      ...typography.h2,
      color: palette.text,
      marginBottom: spacing.sm,
    },
    timeRangeButtons: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    timeRangeButton: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: 'center',
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
    trendSection: {
      marginBottom: spacing.lg,
    },
    trendCard: {
      backgroundColor: palette.accentLight,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.lg,
    },
    trendLabel: {
      ...typography.bodySm,
      color: palette.textSecondary,
      marginBottom: spacing.sm,
    },
    trendValue: {
      ...typography.h3,
      color: palette.text,
    },
    trendDetails: {
      ...typography.bodySm,
      color: palette.textSecondary,
      marginTop: spacing.sm,
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
      ...shadows.sm,
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
    chartContainer: {
      marginBottom: spacing.lg,
    },
    chartTitle: {
      ...typography.h4,
      color: palette.text,
      marginBottom: spacing.md,
    },
    chartBar: {
      flexDirection: 'row',
      marginBottom: spacing.md,
      alignItems: 'flex-end',
      height: 80,
      gap: spacing.sm,
    },
    barColumn: {
      flex: 1,
      backgroundColor: palette.bgSecondary,
      borderRadius: borderRadius.sm,
      overflow: 'hidden',
      justifyContent: 'flex-end',
    },
    barFill: {
      backgroundColor: palette.accent,
    },
    barLabel: {
      ...typography.bodySm,
      color: palette.textSecondary,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    complianceSection: {
      marginTop: spacing.xl,
    },
    complianceTitle: {
      ...typography.h4,
      color: palette.text,
      marginBottom: spacing.md,
    },
    complianceGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    complianceDay: {
      width: '23%',
      alignItems: 'center',
    },
    complianceDayLabel: {
      ...typography.bodySm,
      color: palette.textSecondary,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    complianceButtons: {
      flexDirection: 'row',
      gap: spacing.xs,
      flexWrap: 'wrap',
    },
    complianceButton: {
      width: '100%',
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: 'center',
      minHeight: 36,
      justifyContent: 'center',
    },
    complianceButtonActive: {
      backgroundColor: palette.accent,
      borderColor: palette.accent,
    },
    complianceButtonText: {
      fontSize: 16,
    },
    complianceButtonTextActive: {
      fontSize: 16,
    },
  })

  const maxValue = Math.max(...dailyStats.map((d) => d.average), 200)

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Tendencias</Text>
      </View>

      {/* Time Range Selector */}
      <View style={styles.timeRangeButtons}>
        {(['7d', '30d'] as const).map((range) => (
          <TouchableOpacity
            key={range}
            style={[styles.timeRangeButton, timeRange === range && styles.timeRangeButtonActive]}
            onPress={() => setTimeRange(range)}
          >
            <Text
              style={[
                styles.timeRangeButtonText,
                timeRange === range && styles.timeRangeButtonTextActive,
              ]}
            >
              {range === '7d' ? '7 días' : '30 días'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Trend Indicator */}
      {trend && (
        <View style={styles.trendSection}>
          <View style={styles.trendCard}>
            <Text style={styles.trendLabel}>Tendencia general</Text>
            <Text style={styles.trendValue}>
              {trend.direction === 'mejora' ? '📈 Mejorando' : trend.direction === 'empeora' ? '📉 Empeorando' : '➡️ Estable'}
            </Text>
            <Text style={styles.trendDetails}>
              {trend.change} mg/dL {trend.direction === 'mejora' ? 'disminución' : trend.direction === 'empeora' ? 'aumento' : 'sin cambios'}
            </Text>
          </View>
        </View>
      )}

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
          <Text style={styles.statValue}>{stats.stability}%</Text>
          <Text style={styles.statLabel}>Estabilidad</Text>
        </View>
      </View>

      {/* Chart */}
      {dailyStats.length > 0 && (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Gráfica de tendencia</Text>
          <View style={styles.chartBar}>
            {dailyStats.slice(-14).map((day, idx) => (
              <View key={idx} style={styles.barColumn}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: `${(day.average / maxValue) * 100}%`,
                      backgroundColor:
                        day.average < 70
                          ? colors[colorScheme as 'light' | 'dark'].error
                          : day.average >= (userProfile?.glucoseRange.min ?? 70) &&
                              day.average <= (userProfile?.glucoseRange.max ?? 180)
                            ? colors[colorScheme as 'light' | 'dark'].success
                            : colors[colorScheme as 'light' | 'dark'].warning,
                    },
                  ]}
                />
                <Text style={styles.barLabel}>
                  {format(day.date, 'd')}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Compliance Tracking */}
      <View style={styles.complianceSection}>
        <Text style={styles.complianceTitle}>Cambios aplicados hoy</Text>
        <View style={styles.complianceGrid}>
          {['met', 'missed', 'changed', 'felt'].map((status) => (
            <View key={status} style={styles.complianceDay}>
              <TouchableOpacity
                style={[
                  styles.complianceButton,
                  getComplianceStatus(new Date()) === status && styles.complianceButtonActive,
                ]}
                onPress={() => toggleCompliance(new Date(), status as any)}
              >
                <Text style={styles.complianceButtonText}>
                  {status === 'met' ? '✓' : status === 'missed' ? '✗' : status === 'changed' ? '✎' : '😊'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.complianceDayLabel}>
                {status === 'met'
                  ? 'Cumplí'
                  : status === 'missed'
                    ? 'No cumplí'
                    : status === 'changed'
                      ? 'Lo cambié'
                      : 'Me sentí'}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  )
}
