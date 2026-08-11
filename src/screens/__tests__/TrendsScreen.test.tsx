import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import {
  RangeSelector,
  TrendIndicator,
  SummaryGrid,
  DailyAverageChart,
  AdherenceTracker,
} from '../TrendsScreen';
import type { DailyStat, RangeSummary } from '../../lib/trends';
import type { AdherenceLog } from '../../types';

function stat(dateKey: string, average: number): DailyStat {
  return {
    dateKey,
    dateMs: new Date(`${dateKey}T12:00:00`).getTime(),
    count: 4,
    average,
    min: average - 20,
    max: average + 20,
    timeInRangePct: 80,
    lowCount: 0,
    highCount: 0,
  };
}

const summary: RangeSummary = {
  dayCount: 7,
  readingCount: 43,
  average: 139.7,
  timeInRangePct: 69.7,
  lowEvents: 3,
  highEvents: 7,
  stabilityPct: 74.3,
};

describe('RangeSelector', () => {
  it('marca como activo el rango seleccionado', () => {
    render(<RangeSelector value="7d" onChange={() => {}} />);

    expect(screen.getByTestId('range-7d-active')).toBeOnTheScreen();
    expect(screen.getByTestId('range-30d')).toBeOnTheScreen();
  });

  it('avisa del cambio de rango al tocar la otra opción', () => {
    const onChange = jest.fn();
    render(<RangeSelector value="7d" onChange={onChange} />);

    fireEvent.press(screen.getByTestId('range-30d'));

    expect(onChange).toHaveBeenCalledWith('30d');
  });
});

describe('TrendIndicator', () => {
  it('pide más datos cuando no hay tendencia que mostrar', () => {
    render(<TrendIndicator trend={null} />);

    expect(
      screen.getByText('Necesitas al menos dos días con lecturas para comparar.')
    ).toBeOnTheScreen();
  });

  it('muestra mejora con el signo correcto', () => {
    render(
      <TrendIndicator
        trend={{ direction: 'improving', timeInRangeDelta: 18.4, averageDelta: -21.6 }}
      />
    );

    expect(screen.getByTestId('trend-improving')).toBeOnTheScreen();
    expect(screen.getByText(/Mejorando/)).toBeOnTheScreen();
    expect(screen.getByText(/\+18 puntos de tiempo en rango/)).toBeOnTheScreen();
  });

  it('muestra empeoramiento', () => {
    render(
      <TrendIndicator
        trend={{ direction: 'worsening', timeInRangeDelta: -12.1, averageDelta: 15.2 }}
      />
    );

    expect(screen.getByTestId('trend-worsening')).toBeOnTheScreen();
    expect(screen.getByText(/Empeorando/)).toBeOnTheScreen();
  });

  it('no habla de puntos ganados ni perdidos cuando está estable', () => {
    render(
      <TrendIndicator
        trend={{ direction: 'stable', timeInRangeDelta: 1.2, averageDelta: 2 }}
      />
    );

    expect(screen.getByTestId('trend-stable')).toBeOnTheScreen();
    expect(screen.getByText(/Sin cambio relevante/)).toBeOnTheScreen();
  });
});

describe('SummaryGrid', () => {
  it('muestra las métricas del periodo redondeadas', () => {
    render(<SummaryGrid summary={summary} />);

    expect(screen.getByText('140')).toBeOnTheScreen();
    expect(screen.getByText('70%')).toBeOnTheScreen();
    expect(screen.getByText('74%')).toBeOnTheScreen();
    expect(screen.getByText('Días con datos')).toBeOnTheScreen();
  });

  it('muestra guiones cuando no hay datos suficientes', () => {
    render(
      <SummaryGrid
        summary={{ ...summary, average: null, timeInRangePct: null, stabilityPct: null }}
      />
    );

    expect(screen.getAllByText('--')).toHaveLength(3);
  });
});

describe('DailyAverageChart', () => {
  it('colorea cada barra según dónde cayó el promedio del día', () => {
    render(
      <DailyAverageChart
        daily={[stat('2026-08-01', 120), stat('2026-08-02', 220), stat('2026-08-03', 60)]}
        targetLow={70}
        targetHigh={180}
      />
    );

    expect(screen.getByTestId('bar-2026-08-01-inRange')).toBeOnTheScreen();
    expect(screen.getByTestId('bar-2026-08-02-high')).toBeOnTheScreen();
    expect(screen.getByTestId('bar-2026-08-03-low')).toBeOnTheScreen();
  });

  it('respeta los objetivos del paciente al colorear', () => {
    // 120 está en rango por defecto, pero es alto con estos objetivos.
    render(
      <DailyAverageChart daily={[stat('2026-08-01', 120)]} targetLow={70} targetHigh={110} />
    );

    expect(screen.getByTestId('bar-2026-08-01-high')).toBeOnTheScreen();
  });

  it('no renderiza nada sin días', () => {
    render(<DailyAverageChart daily={[]} targetLow={70} targetHigh={180} />);

    expect(screen.queryByText('Promedio diario')).not.toBeOnTheScreen();
  });
});

describe('AdherenceTracker', () => {
  const log: AdherenceLog = {
    id: 1,
    dateKey: '2026-08-11',
    dateMs: new Date(2026, 7, 11).getTime(),
    status: 'complied',
    mood: null,
    notes: null,
    createdAtMs: Date.now(),
  };

  it('oculta el ánimo hasta que haya un estado registrado', () => {
    render(<AdherenceTracker log={null} onChange={() => {}} />);

    expect(screen.getByTestId('adherence-status-complied')).toBeOnTheScreen();
    expect(screen.queryByText('¿Cómo te sentiste?')).not.toBeOnTheScreen();
  });

  it('marca el estado guardado como activo', () => {
    render(<AdherenceTracker log={log} onChange={() => {}} />);

    expect(screen.getByTestId('adherence-status-complied-active')).toBeOnTheScreen();
    expect(screen.getByText('¿Cómo te sentiste?')).toBeOnTheScreen();
  });

  it('conserva el ánimo al cambiar de estado', () => {
    const onChange = jest.fn();
    render(<AdherenceTracker log={{ ...log, mood: 'good' }} onChange={onChange} />);

    fireEvent.press(screen.getByTestId('adherence-status-modified'));

    expect(onChange).toHaveBeenCalledWith('modified', 'good');
  });

  it('permite desmarcar el ánimo tocándolo de nuevo', () => {
    const onChange = jest.fn();
    render(<AdherenceTracker log={{ ...log, mood: 'good' }} onChange={onChange} />);

    fireEvent.press(screen.getByTestId('adherence-mood-good-active'));

    expect(onChange).toHaveBeenCalledWith('complied', null);
  });
});
