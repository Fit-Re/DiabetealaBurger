import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PatternSelector, StrengthFilterRow, filterEvidence } from '../EvidenceScreen';
import type { ActivationResult } from '../../lib/knowledgeGraph';
import type { PatternFinding } from '../../types';

const patterns: PatternFinding[] = [
  {
    id: 'dawn',
    title: 'Hiperglucemia al despertar',
    description: 'Tus lecturas de la mañana están altas.',
    severity: 'attention',
    suggestedQuery: 'dawn phenomenon',
    evidenceCount: 4,
  },
  {
    id: 'sleep',
    title: 'Sueño corto',
    description: 'Duermes menos de 6 horas.',
    severity: 'watch',
    suggestedQuery: 'sleep glycemic control',
    evidenceCount: 2,
  },
];

function activation(
  paperId: string,
  title: string,
  authors: string,
  confidence: ActivationResult['confidence']
): ActivationResult {
  return {
    paperId,
    paper: {
      id: paperId,
      title,
      authors,
      year: 2023,
      source: 'Diabetes Care',
      url: null,
      topics: [],
      evidenceLevel: 'rct',
      sampleSize: null,
      embedding: [],
      curated: true,
      summary: 'Resumen.',
    },
    activationScore: 0.8,
    path: [paperId],
    hopCount: 0,
    confidence,
  };
}

const results = [
  activation('p1', 'Continuous Glucose Monitoring', 'Beck et al.', 'strong'),
  activation('p2', 'Sleep Quality and Glucose', 'Thompson et al.', 'moderate'),
  activation('p3', 'Stress and Cortisol Effects', 'Patel & Kumar', 'limited'),
];

describe('filterEvidence', () => {
  it('devuelve todo sin búsqueda ni filtro', () => {
    expect(filterEvidence(results, '', 'all')).toHaveLength(3);
  });

  it('filtra por título sin distinguir mayúsculas', () => {
    const found = filterEvidence(results, 'SLEEP', 'all');

    expect(found.map((r) => r.paperId)).toEqual(['p2']);
  });

  it('filtra por autor', () => {
    const found = filterEvidence(results, 'patel', 'all');

    expect(found.map((r) => r.paperId)).toEqual(['p3']);
  });

  it('ignora los espacios alrededor de la búsqueda', () => {
    expect(filterEvidence(results, '   ', 'all')).toHaveLength(3);
    expect(filterEvidence(results, '  beck  ', 'all').map((r) => r.paperId)).toEqual(['p1']);
  });

  it('filtra por fuerza de la evidencia', () => {
    expect(filterEvidence(results, '', 'strong').map((r) => r.paperId)).toEqual(['p1']);
    expect(filterEvidence(results, '', 'limited').map((r) => r.paperId)).toEqual(['p3']);
  });

  it('combina búsqueda y fuerza', () => {
    expect(filterEvidence(results, 'sleep', 'strong')).toEqual([]);
    expect(filterEvidence(results, 'sleep', 'moderate').map((r) => r.paperId)).toEqual(['p2']);
  });
});

describe('PatternSelector', () => {
  it('marca el patrón seleccionado', () => {
    render(<PatternSelector patterns={patterns} selectedId="dawn" onSelect={() => {}} />);

    expect(screen.getByTestId('pattern-chip-dawn-active')).toBeOnTheScreen();
    expect(screen.getByTestId('pattern-chip-sleep')).toBeOnTheScreen();
  });

  it('muestra el título del patrón con su severidad', () => {
    render(<PatternSelector patterns={patterns} selectedId="dawn" onSelect={() => {}} />);

    expect(screen.getByText('🔴 Hiperglucemia al despertar')).toBeOnTheScreen();
    expect(screen.getByText('🟡 Sueño corto')).toBeOnTheScreen();
  });

  it('avisa al elegir otro patrón', () => {
    const onSelect = jest.fn();
    render(<PatternSelector patterns={patterns} selectedId="dawn" onSelect={onSelect} />);

    fireEvent.press(screen.getByTestId('pattern-chip-sleep'));

    expect(onSelect).toHaveBeenCalledWith('sleep');
  });
});

describe('StrengthFilterRow', () => {
  it('marca el filtro activo', () => {
    render(<StrengthFilterRow value="all" onChange={() => {}} />);

    expect(screen.getByTestId('strength-all-active')).toBeOnTheScreen();
    expect(screen.getByText('Sólida')).toBeOnTheScreen();
  });

  it('avisa al cambiar de filtro', () => {
    const onChange = jest.fn();
    render(<StrengthFilterRow value="all" onChange={onChange} />);

    fireEvent.press(screen.getByTestId('strength-moderate'));

    expect(onChange).toHaveBeenCalledWith('moderate');
  });
});
