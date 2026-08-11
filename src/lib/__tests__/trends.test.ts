import {
  buildDailyStats,
  computeTrend,
  summarizeRange,
  toDateKey,
  type DailyStat,
} from '../trends';
import type { GlucoseReading } from '../../types';

function reading(value: number, at: Date): GlucoseReading {
  return {
    id: at.getTime() + value,
    value,
    unit: 'mg/dL',
    timestampMs: at.getTime(),
    source: 'manual',
    trend: null,
    notes: null,
    createdAtMs: at.getTime(),
  };
}

const day1 = (h: number) => new Date(2026, 7, 1, h, 0);
const day2 = (h: number) => new Date(2026, 7, 2, h, 0);

function stat(partial: Partial<DailyStat> & { dateKey: string; dateMs: number }): DailyStat {
  return {
    count: 1,
    average: 120,
    min: 120,
    max: 120,
    timeInRangePct: 100,
    lowCount: 0,
    highCount: 0,
    ...partial,
  };
}

describe('toDateKey', () => {
  it('formatea la fecha local con ceros a la izquierda', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toDateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('buildDailyStats', () => {
  it('agrupa por día local y calcula el promedio de cada uno', () => {
    const daily = buildDailyStats(
      [reading(100, day1(8)), reading(200, day1(20)), reading(100, day2(9))],
      70,
      180
    );

    expect(daily).toHaveLength(2);
    expect(daily[0].dateKey).toBe('2026-08-01');
    expect(daily[0].average).toBe(150);
    expect(daily[0].count).toBe(2);
    expect(daily[1].dateKey).toBe('2026-08-02');
    expect(daily[1].average).toBe(100);
  });

  it('cuenta lecturas fuera de rango según los objetivos recibidos', () => {
    const daily = buildDailyStats([reading(100, day1(8)), reading(200, day1(20))], 70, 180);

    expect(daily[0].timeInRangePct).toBe(50);
    expect(daily[0].highCount).toBe(1);
    expect(daily[0].lowCount).toBe(0);
  });

  it('respeta objetivos personalizados del paciente', () => {
    // 100 está en rango con los objetivos por defecto, pero no con estos.
    const daily = buildDailyStats([reading(100, day1(8))], 110, 140);

    expect(daily[0].lowCount).toBe(1);
    expect(daily[0].timeInRangePct).toBe(0);
  });

  it('ordena de más viejo a más reciente aunque lleguen al revés', () => {
    const daily = buildDailyStats([reading(100, day2(9)), reading(100, day1(8))], 70, 180);

    expect(daily.map((d) => d.dateKey)).toEqual(['2026-08-01', '2026-08-02']);
  });

  it('omite los días sin lecturas en vez de inventarlos con cero', () => {
    // Hay hueco entre el 1 y el 3: el día 2 no debe aparecer.
    const daily = buildDailyStats(
      [reading(100, day1(8)), reading(100, new Date(2026, 7, 3, 8, 0))],
      70,
      180
    );

    expect(daily.map((d) => d.dateKey)).toEqual(['2026-08-01', '2026-08-03']);
  });

  it('devuelve vacío sin lecturas', () => {
    expect(buildDailyStats([], 70, 180)).toEqual([]);
  });
});

describe('computeTrend', () => {
  it('devuelve null con menos de dos días', () => {
    expect(computeTrend([])).toBeNull();
    expect(computeTrend([stat({ dateKey: '2026-08-01', dateMs: 1 })])).toBeNull();
  });

  it('marca mejora cuando sube el tiempo en rango', () => {
    const trend = computeTrend([
      stat({ dateKey: '2026-08-01', dateMs: 1, timeInRangePct: 50, average: 180 }),
      stat({ dateKey: '2026-08-02', dateMs: 2, timeInRangePct: 90, average: 130 }),
    ]);

    expect(trend?.direction).toBe('improving');
    expect(trend?.timeInRangeDelta).toBe(40);
    expect(trend?.averageDelta).toBe(-50);
  });

  it('marca empeoramiento cuando baja el tiempo en rango', () => {
    const trend = computeTrend([
      stat({ dateKey: '2026-08-01', dateMs: 1, timeInRangePct: 90 }),
      stat({ dateKey: '2026-08-02', dateMs: 2, timeInRangePct: 40 }),
    ]);

    expect(trend?.direction).toBe('worsening');
  });

  it('trata los cambios chicos como estables', () => {
    const trend = computeTrend([
      stat({ dateKey: '2026-08-01', dateMs: 1, timeInRangePct: 80 }),
      stat({ dateKey: '2026-08-02', dateMs: 2, timeInRangePct: 82 }),
    ]);

    expect(trend?.direction).toBe('stable');
  });

  it('no llama mejora a un promedio que baja hacia la hipoglucemia', () => {
    // El promedio cae 60 mg/dL, pero es porque el paciente se está yendo abajo:
    // el tiempo en rango se desploma. Guiarse por el promedio diría "mejorando".
    const trend = computeTrend([
      stat({ dateKey: '2026-08-01', dateMs: 1, average: 120, timeInRangePct: 95 }),
      stat({ dateKey: '2026-08-02', dateMs: 2, average: 60, timeInRangePct: 20 }),
    ]);

    expect(trend?.averageDelta).toBe(-60);
    expect(trend?.direction).toBe('worsening');
  });
});

describe('summarizeRange', () => {
  it('devuelve nulos sin días', () => {
    const summary = summarizeRange([]);

    expect(summary.dayCount).toBe(0);
    expect(summary.average).toBeNull();
    expect(summary.timeInRangePct).toBeNull();
    expect(summary.stabilityPct).toBeNull();
  });

  it('pondera el promedio por número de lecturas del día', () => {
    // Un día de 1 lectura no puede pesar lo mismo que uno de 9.
    const summary = summarizeRange([
      stat({ dateKey: '2026-08-01', dateMs: 1, average: 200, count: 1 }),
      stat({ dateKey: '2026-08-02', dateMs: 2, average: 100, count: 9 }),
    ]);

    expect(summary.readingCount).toBe(10);
    expect(summary.average).toBe(110);
  });

  it('suma los eventos altos y bajos del periodo', () => {
    const summary = summarizeRange([
      stat({ dateKey: '2026-08-01', dateMs: 1, lowCount: 2, highCount: 1 }),
      stat({ dateKey: '2026-08-02', dateMs: 2, lowCount: 0, highCount: 3 }),
    ]);

    expect(summary.lowEvents).toBe(2);
    expect(summary.highEvents).toBe(4);
  });

  it('calcula la estabilidad como 100 menos el coeficiente de variación', () => {
    const summary = summarizeRange([
      stat({ dateKey: '2026-08-01', dateMs: 1, average: 150, count: 2 }),
      stat({ dateKey: '2026-08-02', dateMs: 2, average: 100, count: 2 }),
    ]);

    // Promedios 150 y 100: media 125, desviación 25, CV 20% -> estabilidad 80%.
    expect(summary.stabilityPct).toBeCloseTo(80, 5);
  });

  it('no reporta estabilidad con un solo día', () => {
    const summary = summarizeRange([stat({ dateKey: '2026-08-01', dateMs: 1 })]);

    expect(summary.stabilityPct).toBeNull();
    expect(summary.dayCount).toBe(1);
  });
});
