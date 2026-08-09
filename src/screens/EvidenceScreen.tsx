import React, { useState } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  TextInput,
} from 'react-native'
import { colors, spacing, typography, borderRadius, shadows } from '../theme'
import { Card } from '../components/Card'
import { useAppStore } from '../store'

interface ResearchPaper {
  id: string
  title: string
  authors: string
  year: number
  journal: string
  relevanceScore: number
  evidenceStrength: 'high' | 'medium' | 'low'
  citationCount: number
  url: string
  summary: string
}

// Mock research papers data
const mockPapers: ResearchPaper[] = [
  {
    id: '1',
    title: 'Continuous Glucose Monitoring and Tight Glycemic Control',
    authors: 'Beck et al.',
    year: 2023,
    journal: 'Diabetes Care',
    relevanceScore: 0.95,
    evidenceStrength: 'high',
    citationCount: 234,
    url: 'https://example.com/paper1',
    summary: 'Study shows CGM reduces HbA1c by 0.5-1.0% in Type 1 diabetes patients.',
  },
  {
    id: '2',
    title: 'Impact of Meal Timing on Postprandial Glucose Excursions',
    authors: 'Chen & Singh',
    year: 2022,
    journal: 'Clinical Diabetes',
    relevanceScore: 0.87,
    evidenceStrength: 'high',
    citationCount: 156,
    url: 'https://example.com/paper2',
    summary: 'Consistent meal timing reduces glucose variability by 23% in Type 2 diabetes.',
  },
  {
    id: '3',
    title: 'Exercise Timing and Glucose Patterns in Diabetes Management',
    authors: 'Rodriguez, Kim & Lee',
    year: 2023,
    journal: 'Journal of Diabetes Research',
    relevanceScore: 0.82,
    evidenceStrength: 'high',
    citationCount: 98,
    url: 'https://example.com/paper3',
    summary: 'Morning exercise shows greater glucose stabilization than evening exercise.',
  },
  {
    id: '4',
    title: 'Sleep Quality and Fasting Glucose Levels',
    authors: 'Thompson et al.',
    year: 2021,
    journal: 'Sleep Medicine Reviews',
    relevanceScore: 0.71,
    evidenceStrength: 'medium',
    citationCount: 134,
    url: 'https://example.com/paper4',
    summary: '7-8 hours of sleep associated with better fasting glucose control.',
  },
  {
    id: '5',
    title: 'Stress and Cortisol Effects on Glycemic Control',
    authors: 'Patel & Kumar',
    year: 2022,
    journal: 'Psychosomatic Medicine',
    relevanceScore: 0.65,
    evidenceStrength: 'medium',
    citationCount: 87,
    url: 'https://example.com/paper5',
    summary: 'High stress increases morning glucose levels by 15-20 mg/dL.',
  },
]

export const EvidenceScreen: React.FC = () => {
  const colorScheme = useColorScheme() ?? 'light'
  const palette = colors[colorScheme]
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedPaper, setExpandedPaper] = useState<string | null>(null)
  const [selectedStrength, setSelectedStrength] = useState<'all' | 'high' | 'medium' | 'low'>('all')

  const { patterns } = useAppStore()

  const filteredPapers = mockPapers.filter((paper) => {
    const matchesSearch =
      paper.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      paper.authors.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStrength = selectedStrength === 'all' || paper.evidenceStrength === selectedStrength
    return matchesSearch && matchesStrength
  })

  const getStrengthColor = (strength: 'high' | 'medium' | 'low') => {
    switch (strength) {
      case 'high':
        return colors[colorScheme as 'light' | 'dark'].success
      case 'medium':
        return colors[colorScheme as 'light' | 'dark'].warning
      case 'low':
        return colors[colorScheme as 'light' | 'dark'].error
    }
  }

  const getStrengthLabel = (strength: 'high' | 'medium' | 'low') => {
    switch (strength) {
      case 'high':
        return 'Alta'
      case 'medium':
        return 'Media'
      case 'low':
        return 'Baja'
    }
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
    description: {
      ...typography.body,
      color: palette.textSecondary,
      marginBottom: spacing.lg,
    },
    searchContainer: {
      marginBottom: spacing.lg,
    },
    searchInput: {
      ...typography.body,
      backgroundColor: palette.bgSecondary,
      color: palette.text,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderWidth: 1,
      borderColor: palette.border,
      marginBottom: spacing.md,
    },
    filterButtons: {
      flexDirection: 'row',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    filterButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: 'transparent',
    },
    filterButtonActive: {
      backgroundColor: palette.accent,
      borderColor: palette.accent,
    },
    filterButtonText: {
      ...typography.bodySm,
      color: palette.text,
    },
    filterButtonTextActive: {
      color: '#ffffff',
      fontWeight: '600',
    },
    patternConnection: {
      backgroundColor: palette.accentLight,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    patternConnectionTitle: {
      ...typography.label,
      color: palette.accent,
      marginBottom: spacing.sm,
    },
    patternConnectionText: {
      ...typography.body,
      color: palette.text,
    },
    papersList: {
      marginBottom: spacing.xl,
    },
    paperCard: {
      ...shadows.sm,
      marginBottom: spacing.md,
    },
    paperHeader: {
      marginBottom: spacing.md,
    },
    paperTitle: {
      ...typography.h4,
      color: palette.text,
      marginBottom: spacing.sm,
    },
    paperAuthors: {
      ...typography.bodySm,
      color: palette.textSecondary,
      marginBottom: spacing.sm,
    },
    paperMeta: {
      flexDirection: 'row',
      gap: spacing.md,
      flexWrap: 'wrap',
      alignItems: 'center',
    },
    paperYear: {
      ...typography.bodySm,
      color: palette.textSecondary,
    },
    strengthBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.sm,
      alignSelf: 'flex-start',
    },
    strengthBadgeText: {
      ...typography.bodySm,
      color: '#ffffff',
      fontWeight: '600',
    },
    relevanceBar: {
      height: 6,
      backgroundColor: palette.bgSecondary,
      borderRadius: borderRadius.sm,
      overflow: 'hidden',
      marginBottom: spacing.sm,
    },
    relevanceFill: {
      height: '100%',
      backgroundColor: palette.accent,
    },
    citationCount: {
      ...typography.bodySm,
      color: palette.textSecondary,
    },
    paperExpanded: {
      borderTopWidth: 1,
      borderTopColor: palette.border,
      paddingTop: spacing.md,
      marginTop: spacing.md,
    },
    papeSummary: {
      ...typography.body,
      color: palette.text,
      lineHeight: 24,
      marginBottom: spacing.md,
    },
    readMoreButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: palette.accent,
      borderRadius: borderRadius.md,
      alignSelf: 'flex-start',
    },
    readMoreButtonText: {
      ...typography.label,
      color: '#ffffff',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xl,
    },
    emptyStateText: {
      ...typography.body,
      color: palette.textSecondary,
    },
  })

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Evidencia científica</Text>
        <Text style={styles.description}>
          Investigaciones relevantes para tu gestión de diabetes
        </Text>
      </View>

      {/* Pattern Connection */}
      {patterns.length > 0 && (
        <View style={styles.patternConnection}>
          <Text style={styles.patternConnectionTitle}>Relacionado con tus patrones</Text>
          <Text style={styles.patternConnectionText}>
            Hemos encontrado {filteredPapers.length} artículos de investigación que se relacionan con los
            patrones detectados en tus datos.
          </Text>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por título o autor..."
          placeholderTextColor={palette.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {/* Strength Filter */}
        <View style={styles.filterButtons}>
          {(['all', 'high', 'medium', 'low'] as const).map((strength) => (
            <TouchableOpacity
              key={strength}
              style={[
                styles.filterButton,
                selectedStrength === strength && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedStrength(strength)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  selectedStrength === strength && styles.filterButtonTextActive,
                ]}
              >
                {strength === 'all' ? 'Todas' : strength === 'high' ? 'Alta' : strength === 'medium' ? 'Media' : 'Baja'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Papers List */}
      <View style={styles.papersList}>
        {filteredPapers.length > 0 ? (
          filteredPapers.map((paper) => (
            <Card key={paper.id} style={styles.paperCard}>
              <TouchableOpacity onPress={() => setExpandedPaper(expandedPaper === paper.id ? null : paper.id)}>
                <View style={styles.paperHeader}>
                  <Text style={styles.paperTitle}>{paper.title}</Text>
                  <Text style={styles.paperAuthors}>{paper.authors}</Text>
                  <View style={styles.paperMeta}>
                    <Text style={styles.paperYear}>{paper.year}</Text>
                    <View
                      style={[
                        styles.strengthBadge,
                        { backgroundColor: getStrengthColor(paper.evidenceStrength) },
                      ]}
                    >
                      <Text style={styles.strengthBadgeText}>
                        Evidencia {getStrengthLabel(paper.evidenceStrength)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.relevanceBar}>
                    <View
                      style={[styles.relevanceFill, { width: `${paper.relevanceScore * 100}%` }]}
                    />
                  </View>
                  <Text style={styles.citationCount}>
                    {paper.citationCount} citas
                  </Text>
                </View>

                {expandedPaper === paper.id && (
                  <View style={styles.paperExpanded}>
                    <Text style={styles.papeSummary}>{paper.summary}</Text>
                    <TouchableOpacity style={styles.readMoreButton}>
                      <Text style={styles.readMoreButtonText}>Leer artículo completo</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            </Card>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No se encontraron artículos</Text>
          </View>
        )}
      </View>

      <View style={{ height: spacing.lg }} />
    </ScrollView>
  )
}
