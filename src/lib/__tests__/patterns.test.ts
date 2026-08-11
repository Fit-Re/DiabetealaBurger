import { detectPatterns } from '../patterns';
import type { GlucoseReading, Meal, Medication, MedicationLog } from '../../types';

describe('Pattern Detection', () => {
  const createReading = (value: number, timestampMs: number): GlucoseReading => ({
    id: Math.random(),
    value,
    unit: 'mg/dL',
    timestampMs,
    source: 'manual',
    trend: null,
    notes: null,
    createdAtMs: Date.now(),
  });

  // detectPatterns clasifica por hora local (getHours), así que los timestamps se
  // construyen con hora local explícita en vez de desplazamientos sobre Date.now():
  // de lo contrario el resultado dependería de la hora a la que corran los tests.
  const atLocal = (daysAgo: number, hour: number): number =>
    new Date(2026, 0, 15 - daysAgo, hour, 0, 0, 0).getTime();

  describe('Low Time in Range', () => {
    it('no reporta hallazgo cuando el tiempo en rango es normal', () => {
      // 12 lecturas (supera el mínimo de 10) todas dentro de 70-180 mg/dL.
      const readings: GlucoseReading[] = Array.from({ length: 12 }, (_, i) =>
        createReading(100, atLocal(0, 8) + i * 300000)
      );

      const findings = detectPatterns(readings, [], [], [], [], 70);

      expect(findings.find(f => f.id === 'low_time_in_range')).toBeUndefined();
      expect(findings.find(f => f.id === 'low_time_below_range')).toBeUndefined();
    });

    it('reporta tiempo en rango bajo cuando el TIR queda por debajo del 70%', () => {
      // 12 lecturas: 4 en rango (33% TIR) y 8 altas, sin ninguna por debajo del
      // umbral, para aislar low_time_in_range de low_time_below_range.
      const readings: GlucoseReading[] = [
        ...Array.from({ length: 4 }, (_, i) => createReading(120, atLocal(0, 8) + i * 300000)),
        ...Array.from({ length: 8 }, (_, i) => createReading(250, atLocal(0, 10) + i * 300000)),
      ];

      const findings = detectPatterns(readings, [], [], [], [], 70);
      const lowTir = findings.find(f => f.id === 'low_time_in_range');

      expect(lowTir).toBeDefined();
      expect(lowTir?.severity).toBe('watch');
    });

    it('reporta tiempo bajo rango cuando se supera el 4% de lecturas bajas', () => {
      const readings: GlucoseReading[] = Array.from({ length: 20 }, (_, i) =>
        createReading(60, atLocal(0, 8) + i * 300000)
      );

      const findings = detectPatterns(readings, [], [], [], [], 70);
      const belowRange = findings.find(f => f.id === 'low_time_below_range');

      expect(belowRange).toBeDefined();
      expect(belowRange?.severity).toBe('attention');
    });
  });

  describe('Nocturnal Hypoglycemia', () => {
    it('detecta hipoglucemias nocturnas en noches distintas', () => {
      // Requiere al menos 2 noches distintas con lecturas <70 entre las 0 y las 6.
      const readings: GlucoseReading[] = [
        createReading(55, atLocal(1, 1)),
        createReading(50, atLocal(1, 2)),
        createReading(58, atLocal(0, 3)),
      ];

      const findings = detectPatterns(readings, [], [], [], [], 70);
      const nocturnal = findings.find(f => f.id === 'nocturnal_hypoglycemia');

      expect(nocturnal).toBeDefined();
      expect(nocturnal?.severity).toBe('attention');
    });

    it('no reporta el patrón si solo hay una noche afectada', () => {
      const readings: GlucoseReading[] = [
        createReading(55, atLocal(0, 1)),
        createReading(50, atLocal(0, 2)),
      ];

      const findings = detectPatterns(readings, [], [], [], [], 70);

      expect(findings.find(f => f.id === 'nocturnal_hypoglycemia')).toBeUndefined();
    });

    it('ignora lecturas bajas diurnas para el patrón nocturno', () => {
      const readings: GlucoseReading[] = [
        createReading(60, atLocal(1, 10)),
        createReading(65, atLocal(0, 17)),
      ];

      const findings = detectPatterns(readings, [], [], [], [], 70);
      const nocturnal = findings.find(f => f.id === 'nocturnal_hypoglycemia');

      expect(nocturnal).toBeUndefined();
    });
  });

  describe('Threshold Adaptivity', () => {
    it('should use custom target low threshold', () => {
      const readings: GlucoseReading[] = [
        createReading(75, Date.now() - 3600000),
        createReading(80, Date.now()),
      ];

      const findings = detectPatterns(readings, [], [], [], [], 100); // Custom high threshold

      expect(findings).toBeDefined();
    });

    it('should fall back to default threshold if null', () => {
      const readings: GlucoseReading[] = [
        createReading(100, Date.now()),
      ];

      // Pass undefined targetLow to use default
      const findings = detectPatterns(readings, [], [], []);

      expect(findings).toBeDefined();
      expect(Array.isArray(findings)).toBe(true);
    });
  });

  describe('Multiple Readings', () => {
    it('should handle empty readings gracefully', () => {
      const findings = detectPatterns([], [], [], [], [], 70);

      expect(Array.isArray(findings)).toBe(true);
    });

    it('should handle single reading', () => {
      const readings: GlucoseReading[] = [createReading(100, Date.now())];

      const findings = detectPatterns(readings, [], [], [], [], 70);

      expect(Array.isArray(findings)).toBe(true);
    });
  });

  describe('Pattern Severity', () => {
    it('should rank patterns by severity (attention > watch > info)', () => {
      const readings: GlucoseReading[] = Array.from({ length: 30 }, (_, i) =>
        createReading(50 + Math.random() * 100, Date.now() - (i * 300000))
      );

      const findings = detectPatterns(readings, [], [], [], [], 70);

      if (findings.length > 1) {
        const severityOrder = { attention: 0, watch: 1, info: 2 };
        for (let i = 0; i < findings.length - 1; i++) {
          const current = severityOrder[findings[i].severity];
          const next = severityOrder[findings[i + 1].severity];
          expect(current).toBeLessThanOrEqual(next);
        }
      }
    });
  });
});
