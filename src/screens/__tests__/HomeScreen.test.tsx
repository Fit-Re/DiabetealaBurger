import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { CurrentReadingCard, StatCard, LifestyleCard } from '../HomeScreen';
import type { GlucoseReading, LifestyleMetric } from '../../types';

const reading = (value: number): GlucoseReading => ({
  id: value,
  value,
  unit: 'mg/dL',
  timestampMs: new Date(2026, 7, 11, 8, 30).getTime(),
  source: 'manual',
  trend: null,
  notes: null,
  createdAtMs: Date.now(),
});

describe('CurrentReadingCard', () => {
  it('marca como en rango una lectura dentro de los objetivos', () => {
    render(
      <CurrentReadingCard reading={reading(112)} isToday targetLow={70} targetHigh={180} />
    );

    expect(screen.getByTestId('reading-card-inRange')).toBeOnTheScreen();
    expect(screen.getByText('112')).toBeOnTheScreen();
    expect(screen.getByText('mg/dL')).toBeOnTheScreen();
  });

  it('marca como baja una lectura por debajo del objetivo', () => {
    render(
      <CurrentReadingCard reading={reading(58)} isToday targetLow={70} targetHigh={180} />
    );

    expect(screen.getByTestId('reading-card-low')).toBeOnTheScreen();
  });

  it('marca como alta una lectura por encima del objetivo', () => {
    render(
      <CurrentReadingCard reading={reading(243)} isToday targetLow={70} targetHigh={180} />
    );

    expect(screen.getByTestId('reading-card-high')).toBeOnTheScreen();
  });

  it('trata los límites del rango como dentro de rango', () => {
    render(
      <CurrentReadingCard reading={reading(70)} isToday targetLow={70} targetHigh={180} />
    );
    expect(screen.getByTestId('reading-card-inRange')).toBeOnTheScreen();

    screen.unmount();

    render(
      <CurrentReadingCard reading={reading(180)} isToday targetLow={70} targetHigh={180} />
    );
    expect(screen.getByTestId('reading-card-inRange')).toBeOnTheScreen();
  });

  it('respeta objetivos personalizados del paciente', () => {
    // 112 está en rango con los objetivos por defecto, pero no con estos.
    render(
      <CurrentReadingCard reading={reading(112)} isToday targetLow={80} targetHigh={110} />
    );

    expect(screen.getByTestId('reading-card-high')).toBeOnTheScreen();
  });

  it('cambia el encabezado cuando no es el día de hoy', () => {
    render(
      <CurrentReadingCard reading={reading(112)} isToday={false} targetLow={70} targetHigh={180} />
    );

    expect(screen.getByText('Última lectura del día')).toBeOnTheScreen();
    expect(screen.queryByText('Glucosa')).not.toBeOnTheScreen();
  });
});

describe('StatCard', () => {
  it('muestra valor y etiqueta', () => {
    render(<StatCard label="Tiempo en rango" value="74%" />);

    expect(screen.getByText('74%')).toBeOnTheScreen();
    expect(screen.getByText('Tiempo en rango')).toBeOnTheScreen();
  });
});

describe('LifestyleCard', () => {
  const metric = {
    id: 1,
    dateMs: new Date(2026, 7, 11).getTime(),
    sleepScore: 82,
    sleepDurationMin: 447,
    hrvMs: 61,
    restingHeartRate: 58,
    recoveryIndex: 74,
    steps: 8432,
  } as LifestyleMetric;

  it('capitaliza solo la inicial de la fecha', () => {
    render(<LifestyleCard metric={metric} />);

    // es-MX devuelve "martes, 11 de agosto": las preposiciones y el mes van en
    // minúscula. textTransform:"capitalize" daba "Martes, 11 De Agosto".
    expect(screen.getByText('Martes, 11 de agosto')).toBeOnTheScreen();
  });

  it('formatea la duración de sueño en horas y minutos', () => {
    render(<LifestyleCard metric={metric} />);

    expect(screen.getByText('7h 27m')).toBeOnTheScreen();
  });

  it('muestra un guion cuando falta una métrica', () => {
    render(<LifestyleCard metric={{ ...metric, hrvMs: null } as LifestyleMetric} />);

    expect(screen.getByText('--')).toBeOnTheScreen();
  });
});
