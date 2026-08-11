import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { EvidencePaperCard } from '../EvidencePaperCard';
import type { ActivationResult } from '../../lib/knowledgeGraph';

const basePaper: ActivationResult['paper'] = {
  id: 'p1',
  title: 'Continuous Glucose Monitoring and Tight Glycemic Control',
  authors: 'Beck et al.',
  year: 2023,
  source: 'Diabetes Care',
  url: 'https://example.org/p1',
  topics: ['cgm_targets'],
  evidenceLevel: 'rct',
  sampleSize: 120,
  embedding: [],
  curated: true,
  summary: 'El MCG reduce la HbA1c entre 0.5 y 1.0 puntos.',
};

function result(
  overrides: Partial<Omit<ActivationResult, 'paper'>> & {
    paper?: Partial<ActivationResult['paper']>;
  } = {}
): ActivationResult {
  const { paper: paperOverrides, ...rest } = overrides;
  return {
    paperId: 'p1',
    activationScore: 0.95,
    path: ['p1'],
    hopCount: 0,
    confidence: 'strong',
    ...rest,
    // Después del spread a propósito: si no, un override parcial de `paper`
    // reemplazaría el objeto entero y dejaría la tarjeta sin título ni autores.
    paper: { ...basePaper, ...(paperOverrides ?? {}) },
  };
}

describe('EvidencePaperCard', () => {
  it('muestra los metadatos reales del paper', () => {
    render(
      <EvidencePaperCard
        result={result()}
        expanded={false}
        onToggle={() => {}}
        feedback={undefined}
        onFeedback={() => {}}
      />
    );

    expect(screen.getByText('Beck et al.')).toBeOnTheScreen();
    expect(screen.getByText('2023 · Diabetes Care')).toBeOnTheScreen();
    expect(screen.getByText('Evidencia Sólida')).toBeOnTheScreen();
  });

  it('traduce la confianza del grafo a la etiqueta de fuerza', () => {
    render(
      <EvidencePaperCard
        result={result({ confidence: 'limited' })}
        expanded={false}
        onToggle={() => {}}
        feedback={undefined}
        onFeedback={() => {}}
      />
    );

    expect(screen.getByText('Evidencia Limitada')).toBeOnTheScreen();
  });

  it('describe una coincidencia directa cuando no hubo saltos', () => {
    render(
      <EvidencePaperCard
        result={result()}
        expanded={false}
        onToggle={() => {}}
        feedback={undefined}
        onFeedback={() => {}}
      />
    );

    expect(screen.getByText(/coincidencia directa/)).toBeOnTheScreen();
  });

  it('pluraliza los saltos del grafo', () => {
    render(
      <EvidencePaperCard
        result={result({ hopCount: 2, path: ['seed', 'p1'] })}
        expanded={false}
        onToggle={() => {}}
        feedback={undefined}
        onFeedback={() => {}}
      />
    );

    expect(screen.getByText(/2 saltos en el grafo/)).toBeOnTheScreen();
  });

  it('marca los papers no curados como no revisados', () => {
    render(
      <EvidencePaperCard
        result={result({ paper: { curated: false } })}
        expanded={false}
        onToggle={() => {}}
        feedback={undefined}
        onFeedback={() => {}}
      />
    );

    expect(screen.getByText(/No revisado/)).toBeOnTheScreen();
  });

  it('oculta el resumen mientras está colapsado', () => {
    render(
      <EvidencePaperCard
        result={result()}
        expanded={false}
        onToggle={() => {}}
        feedback={undefined}
        onFeedback={() => {}}
      />
    );

    expect(
      screen.queryByText('El MCG reduce la HbA1c entre 0.5 y 1.0 puntos.')
    ).not.toBeOnTheScreen();
  });

  it('muestra resumen, ruta y feedback al expandirse', () => {
    render(
      <EvidencePaperCard
        result={result({ path: ['seed', 'p1'] })}
        expanded
        onToggle={() => {}}
        feedback={undefined}
        onFeedback={() => {}}
      />
    );

    expect(screen.getByText('El MCG reduce la HbA1c entre 0.5 y 1.0 puntos.')).toBeOnTheScreen();
    expect(screen.getByText('Ruta: seed → p1')).toBeOnTheScreen();
    expect(screen.getByText('👍 Útil')).toBeOnTheScreen();
  });

  it('reporta la opinión del paciente sobre el paper', () => {
    const onFeedback = jest.fn();
    render(
      <EvidencePaperCard
        result={result()}
        expanded
        onToggle={() => {}}
        feedback={undefined}
        onFeedback={onFeedback}
      />
    );

    fireEvent.press(screen.getByText('👎 No ayudó'));

    expect(onFeedback).toHaveBeenCalledWith(false);
  });

  it('no ofrece abrir el artículo si no hay enlace', () => {
    render(
      <EvidencePaperCard
        result={result({ paper: { url: null } })}
        expanded
        onToggle={() => {}}
        feedback={undefined}
        onFeedback={() => {}}
      />
    );

    expect(screen.queryByText('Leer artículo completo')).not.toBeOnTheScreen();
  });
});
