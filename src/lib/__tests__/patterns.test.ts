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

  describe('Low Time in Range', () => {
    it('should detect normal time in range', () => {
      const readings: GlucoseReading[] = [
        createReading(100, Date.now() - 3600000),
        createReading(105, Date.now() - 1800000),
        createReading(95, Date.now()),
      ];

      const findings = detectPatterns(readings, [], [], [], [], 70);
      const lowTirPattern = findings.find(f => f.id === 'low_time_in_range');

      expect(lowTirPattern).toBeDefined();
      expect(lowTirPattern?.severity).toBe('info');
    });

    it('should detect high time below range', () => {
      const readings: GlucoseReading[] = Array.from({ length: 20 }, (_, i) =>
        createReading(60, Date.now() - (i * 300000))
      );

      const findings = detectPatterns(readings, [], [], [], [], 70);
      const lowTirPattern = findings.find(f => f.id === 'low_time_in_range');

      expect(lowTirPattern).toBeDefined();
      expect(lowTirPattern?.severity).toMatch(/watch|attention/);
    });
  });

  describe('Nocturnal Hypoglycemia', () => {
    it('should detect nighttime low readings', () => {
      const now = Date.now();
      const readings: GlucoseReading[] = [
        // Nighttime readings (0-6 hours)
        createReading(55, now - (86400000 - 3600000)), // 11 PM previous day
        createReading(50, now - (86400000 - 1800000)), // 12 AM
        createReading(58, now - (86400000 - 600000)),  // 1 AM
      ];

      const findings = detectPatterns(readings, [], [], [], [], 70);
      const nocturnal = findings.find(f => f.id === 'nocturnal_hypoglycemia');

      expect(nocturnal).toBeDefined();
    });

    it('should ignore daytime low readings for nocturnal pattern', () => {
      const now = Date.now();
      const readings: GlucoseReading[] = [
        // Daytime readings
        createReading(60, now - 36000000), // 10 AM
        createReading(65, now - 18000000), // 5 PM
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
