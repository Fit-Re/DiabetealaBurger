import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  RefreshControl,
  Pressable,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LineChart } from "react-native-chart-kit";
import {
  computeStats,
  deleteReading,
  getReadingsSince,
} from "../db/database";
import type { GlucoseReading } from "../types";
import { TARGET_RANGE, TREND_LABELS } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;

export default function HomeScreen() {
  const [readings, setReadings] = useState<GlucoseReading[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const rows = await getReadingsSince(Date.now() - DAY_MS);
    setReadings(rows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onDelete = (id: number) => {
    Alert.alert("Eliminar lectura", "¿Seguro que quieres eliminarla?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          await deleteReading(id);
          load();
        },
      },
    ]);
  };

  const stats = computeStats(readings);
  const chronological = [...readings].reverse();
  const chartData =
    chronological.length > 0
      ? {
          labels: chronological.map((r) =>
            new Date(r.timestampMs).toLocaleTimeString("es-MX", {
              hour: "2-digit",
              minute: "2-digit",
            })
          ),
          datasets: [{ data: chronological.map((r) => r.value) }],
        }
      : null;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>Últimas 24 horas</Text>

      {chartData && chartData.labels.length > 1 ? (
        <LineChart
          data={chartData}
          width={Dimensions.get("window").width - 32}
          height={220}
          yAxisSuffix=""
          chartConfig={{
            backgroundColor: "#ffffff",
            backgroundGradientFrom: "#ffffff",
            backgroundGradientTo: "#ffffff",
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(55, 65, 81, ${opacity})`,
            propsForDots: { r: "3" },
          }}
          bezier
          style={styles.chart}
        />
      ) : (
        <View style={styles.emptyChart}>
          <Text style={styles.emptyText}>
            Necesitas al menos 2 lecturas hoy para ver la gráfica.
          </Text>
        </View>
      )}

      <View style={styles.statsRow}>
        <StatCard label="Promedio" value={fmt(stats.average)} />
        <StatCard
          label="Tiempo en rango"
          value={stats.timeInRangePct != null ? `${stats.timeInRangePct.toFixed(0)}%` : "--"}
        />
        <StatCard label="Lecturas" value={String(stats.count)} />
      </View>
      <View style={styles.statsRow}>
        <StatCard label="Mínimo" value={fmt(stats.min)} />
        <StatCard label="Máximo" value={fmt(stats.max)} />
        <StatCard label={`Bajas (<${TARGET_RANGE.low})`} value={String(stats.lowCount)} />
      </View>

      <Text style={styles.subtitle}>Lecturas recientes</Text>
      {readings.length === 0 && (
        <Text style={styles.emptyText}>
          Aún no hay lecturas. Agrega una manualmente o importa una captura de LibreLink.
        </Text>
      )}
      {readings.map((r) => (
        <Pressable
          key={r.id}
          style={styles.readingRow}
          onLongPress={() => onDelete(r.id)}
        >
          <View>
            <Text style={styles.readingValue}>
              {r.value} {r.unit}
            </Text>
            <Text style={styles.readingMeta}>
              {new Date(r.timestampMs).toLocaleString("es-MX")} ·{" "}
              {r.source === "manual" ? "Manual" : "LibreLink"}
            </Text>
            {r.trend && (
              <Text style={styles.readingMeta}>{TREND_LABELS[r.trend]}</Text>
            )}
          </View>
        </Pressable>
      ))}
      <Text style={styles.hint}>Mantén presionada una lectura para eliminarla.</Text>
      <Text style={styles.disclaimer}>
        Esta app es una herramienta de apoyo y registro personal. No sustituye el
        criterio médico de tu equipo de endocrinología.
      </Text>
    </ScrollView>
  );
}

function fmt(n: number | null): string {
  return n == null ? "--" : n.toFixed(0);
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", padding: 16 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 8, color: "#111827" },
  subtitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
    color: "#111827",
  },
  chart: { borderRadius: 12, marginBottom: 8 },
  emptyChart: {
    height: 100,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 8,
  },
  emptyText: { color: "#6b7280", textAlign: "center" },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  statValue: { fontSize: 18, fontWeight: "700", color: "#111827" },
  statLabel: { fontSize: 11, color: "#6b7280", marginTop: 2, textAlign: "center" },
  readingRow: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  readingValue: { fontSize: 16, fontWeight: "600", color: "#111827" },
  readingMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  hint: { fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 8 },
  disclaimer: {
    fontSize: 11,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 16,
    marginBottom: 32,
    fontStyle: "italic",
  },
});
