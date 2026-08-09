import React, { useState } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  Switch,
  TextInput,
} from 'react-native'
import { useAppStore } from '../store'
import { colors, spacing, typography, borderRadius } from '../theme'

export const SettingsScreen: React.FC = () => {
  const colorScheme = useColorScheme() ?? 'light'
  const palette = colors[colorScheme]
  const { userProfile, setUserProfile, colorScheme: appColorScheme, setColorScheme } = useAppStore()
  const [editingField, setEditingField] = useState<string | null>(null)

  const handleSave = (field: string, value: any) => {
    if (userProfile) {
      setUserProfile({ ...userProfile, [field]: value })
      setEditingField(null)
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
      marginBottom: spacing.xl,
    },
    title: {
      ...typography.h2,
      color: palette.text,
      marginBottom: spacing.sm,
    },
    subtitle: {
      ...typography.body,
      color: palette.textSecondary,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionTitle: {
      ...typography.h4,
      color: palette.text,
      marginBottom: spacing.md,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    settingItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    settingLabel: {
      ...typography.body,
      color: palette.text,
      flex: 1,
    },
    settingValue: {
      ...typography.body,
      color: palette.textSecondary,
      marginRight: spacing.md,
    },
    editInput: {
      ...typography.body,
      color: palette.text,
      borderBottomWidth: 2,
      borderBottomColor: palette.accent,
      paddingBottom: spacing.xs,
      minWidth: 100,
    },
    toggleSwitch: {
      transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }],
    },
    button: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: palette.accent,
      borderRadius: borderRadius.md,
    },
    buttonText: {
      ...typography.label,
      color: '#ffffff',
    },
    divider: {
      height: 1,
      backgroundColor: palette.border,
      marginVertical: spacing.lg,
    },
    description: {
      ...typography.bodySm,
      color: palette.textSecondary,
      marginTop: spacing.sm,
    },
  })

  if (!userProfile) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={typography.body}>Cargando perfil...</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Configuración</Text>
        <Text style={styles.subtitle}>Administra tu perfil e integraciones</Text>
      </View>

      {/* Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Perfil</Text>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Nombre</Text>
          {editingField === 'name' ? (
            <TextInput
              style={styles.editInput}
              value={userProfile.name}
              onChangeText={(value) => handleSave('name', value)}
              autoFocus
              onBlur={() => setEditingField(null)}
            />
          ) : (
            <>
              <Text style={styles.settingValue}>{userProfile.name}</Text>
              <TouchableOpacity onPress={() => setEditingField('name')}>
                <Text style={{ color: palette.accent }}>Editar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Tipo de diabetes</Text>
          <Text style={styles.settingValue}>
            {userProfile.diabetesType === 'T1D'
              ? 'Tipo 1'
              : userProfile.diabetesType === 'T2D'
                ? 'Tipo 2'
                : userProfile.diabetesType === 'gestational'
                  ? 'Gestacional'
                  : 'Otro'}
          </Text>
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Rango de glucosa objetivo</Text>
          <Text style={styles.settingValue}>
            {userProfile.glucoseRange.min} - {userProfile.glucoseRange.max} mg/dL
          </Text>
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Peso</Text>
          <Text style={styles.settingValue}>{userProfile.weight} kg</Text>
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Altura</Text>
          <Text style={styles.settingValue}>{userProfile.height} cm</Text>
        </View>

        <View style={styles.settingItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Tipo de insulina</Text>
            <Text style={styles.description}>{userProfile.insulinType}</Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Integrations Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Integraciones</Text>

        <View style={styles.settingItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>LibreLink</Text>
            <Text style={styles.description}>Sincroniza lecturas de FreeStyle Libre</Text>
          </View>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Conectar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Ultrahuman</Text>
            <Text style={styles.description}>Sincroniza datos de Ring y salud</Text>
          </View>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Conectar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Dexcom</Text>
            <Text style={styles.description}>Sincroniza CGM en tiempo real</Text>
          </View>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Conectar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notificaciones</Text>

        <View style={styles.settingItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Alertas de glucosa baja</Text>
            <Text style={styles.description}>Notifica cuando glucosa &lt; 70</Text>
          </View>
          <Switch style={styles.toggleSwitch} value={true} />
        </View>

        <View style={styles.settingItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Alertas de glucosa alta</Text>
            <Text style={styles.description}>Notifica cuando glucosa &gt; 180</Text>
          </View>
          <Switch style={styles.toggleSwitch} value={true} />
        </View>

        <View style={styles.settingItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Recordatorio de ejercicio</Text>
            <Text style={styles.description}>Recordatorio diario 19:00</Text>
          </View>
          <Switch style={styles.toggleSwitch} value={false} />
        </View>
      </View>

      <View style={styles.divider} />

      {/* Appearance Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Apariencia</Text>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Tema</Text>
          <Text style={styles.settingValue}>
            {appColorScheme === 'auto' ? 'Automático' : appColorScheme === 'light' ? 'Claro' : 'Oscuro'}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Acerca de</Text>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Versión</Text>
          <Text style={styles.settingValue}>0.1.0</Text>
        </View>

        <View style={styles.settingItem}>
          <TouchableOpacity>
            <Text style={{ color: palette.accent, ...typography.body }}>Términos de servicio</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingItem}>
          <TouchableOpacity>
            <Text style={{ color: palette.accent, ...typography.body }}>Política de privacidad</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  )
}
