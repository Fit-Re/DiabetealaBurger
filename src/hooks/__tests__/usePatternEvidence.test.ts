import { Alert } from 'react-native';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { usePatternEvidence } from '../usePatternEvidence';
import {
  getPatientPaperFeedback,
  initializeKnowledgeGraph,
  recordPatternFeedback,
  searchViaGraphPersonalized,
} from '../../lib/knowledgeBase';
import { synthesizeEvidence } from '../../lib/geminiVision';
import type { ActivationResult } from '../../lib/knowledgeGraph';
import type { PatternFinding } from '../../types';

jest.mock('../../lib/knowledgeBase', () => ({
  initializeKnowledgeGraph: jest.fn(),
  searchViaGraphPersonalized: jest.fn(),
  recordPatternFeedback: jest.fn(),
  getPatientPaperFeedback: jest.fn(),
}));

jest.mock('../../lib/geminiVision', () => ({
  synthesizeEvidence: jest.fn(),
}));

jest.mock('../../lib/auth', () => ({
  useAuth: () => ({ session: { user: { id: 'paciente-1' } } }),
}));

const mockInit = initializeKnowledgeGraph as jest.Mock;
const mockSearch = searchViaGraphPersonalized as jest.Mock;
const mockRecord = recordPatternFeedback as jest.Mock;
const mockGetFeedback = getPatientPaperFeedback as jest.Mock;
const mockSynthesize = synthesizeEvidence as jest.Mock;

function pattern(overrides: Partial<PatternFinding> = {}): PatternFinding {
  return {
    id: 'dawn',
    title: 'Hiperglucemia al despertar',
    description: 'Lecturas altas por la mañana.',
    severity: 'attention',
    suggestedQuery: 'dawn phenomenon',
    evidenceCount: 2,
    ...overrides,
  };
}

function activation(paperId: string): ActivationResult {
  return {
    paperId,
    paper: {
      id: paperId,
      title: `Paper ${paperId}`,
      authors: 'Autor et al.',
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
    activationScore: 0.9,
    path: [paperId],
    hopCount: 0,
    confidence: 'strong',
  };
}

const synthesis = {
  etiology: 'Pico de cortisol.',
  management: 'Hablar del ajuste basal.',
  likelyOutcome: 'Mejora en semanas.',
  evidenceStrength: 'moderate' as const,
  caveats: null,
};

describe('usePatternEvidence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInit.mockResolvedValue(undefined);
    mockSearch.mockResolvedValue([activation('p1'), activation('p2')]);
    mockGetFeedback.mockResolvedValue(null);
    mockRecord.mockResolvedValue(undefined);
    mockSynthesize.mockResolvedValue(synthesis);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  describe('loadEvidence', () => {
    it('inicializa el grafo y guarda los papers encontrados', async () => {
      const { result } = renderHook(() => usePatternEvidence(pattern()));

      await act(async () => {
        await result.current.loadEvidence();
      });

      expect(mockInit).toHaveBeenCalled();
      expect(result.current.evidence).toHaveLength(2);
      expect(result.current.searching).toBe(false);
    });

    it('busca con el id del paciente y la consulta sugerida del patrón', async () => {
      const { result } = renderHook(() => usePatternEvidence(pattern(), 6));

      await act(async () => {
        await result.current.loadEvidence();
      });

      expect(mockSearch).toHaveBeenCalledWith(
        'dawn phenomenon',
        'paciente-1',
        1,
        1.0,
        6,
        'dawn'
      );
    });

    it.each([
      ['attention', 1.0],
      ['watch', 0.6],
      ['info', 0.3],
    ] as const)('traduce la severidad %s al peso %s', async (severity, weight) => {
      const { result } = renderHook(() => usePatternEvidence(pattern({ severity })));

      await act(async () => {
        await result.current.loadEvidence();
      });

      expect(mockSearch).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        1,
        weight,
        expect.anything(),
        expect.anything()
      );
    });

    it('no vuelve a buscar si la evidencia ya está cargada', async () => {
      const { result } = renderHook(() => usePatternEvidence(pattern()));

      await act(async () => {
        await result.current.loadEvidence();
      });
      await act(async () => {
        await result.current.loadEvidence();
      });

      expect(mockSearch).toHaveBeenCalledTimes(1);
    });

    it('no busca nada si todavía no hay patrón seleccionado', async () => {
      const { result } = renderHook(() => usePatternEvidence(null));

      await act(async () => {
        await result.current.loadEvidence();
      });

      expect(mockSearch).not.toHaveBeenCalled();
      expect(result.current.evidence).toBeNull();
    });

    it('recupera el feedback previo del paciente sobre cada paper', async () => {
      mockGetFeedback.mockImplementation(async (_patientId: string, paperId: string) =>
        paperId === 'p1' ? { wasHelpful: true } : null
      );

      const { result } = renderHook(() => usePatternEvidence(pattern()));

      await act(async () => {
        await result.current.loadEvidence();
      });

      expect(result.current.feedbackStates).toEqual({ p1: true });
    });

    it('avisa del error y deja de buscar si la búsqueda falla', async () => {
      mockSearch.mockRejectedValue(new Error('grafo caído'));

      const { result } = renderHook(() => usePatternEvidence(pattern()));

      await act(async () => {
        await result.current.loadEvidence();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'grafo caído');
      expect(result.current.searching).toBe(false);
      expect(result.current.evidence).toBeNull();
    });
  });

  describe('al cambiar de patrón', () => {
    it('descarta la evidencia del patrón anterior', async () => {
      const { result, rerender } = renderHook(
        ({ p }: { p: PatternFinding }) => usePatternEvidence(p),
        { initialProps: { p: pattern() } }
      );

      await act(async () => {
        await result.current.loadEvidence();
      });
      expect(result.current.evidence).toHaveLength(2);

      rerender({ p: pattern({ id: 'sleep', suggestedQuery: 'sleep' }) });

      // Si no se limpiara, los papers del patrón anterior quedarían debajo del
      // título del nuevo.
      await waitFor(() => expect(result.current.evidence).toBeNull());
      expect(result.current.synthesis).toBeNull();
      expect(result.current.feedbackStates).toEqual({});
    });
  });

  describe('sendFeedback', () => {
    it('registra la opinión y la refleja en el estado', async () => {
      const { result } = renderHook(() => usePatternEvidence(pattern()));

      await act(async () => {
        await result.current.sendFeedback('p1', true);
      });

      expect(mockRecord).toHaveBeenCalledWith('paciente-1', 'dawn', 'p1', true);
      expect(result.current.feedbackStates.p1).toBe(true);
    });

    it('avisa si no se pudo registrar', async () => {
      mockRecord.mockRejectedValue(new Error('sin conexión'));

      const { result } = renderHook(() => usePatternEvidence(pattern()));

      await act(async () => {
        await result.current.sendFeedback('p1', false);
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'No se pudo registrar tu opinión.');
      expect(result.current.feedbackStates.p1).toBeUndefined();
    });
  });

  describe('synthesize', () => {
    it('sintetiza sobre la evidencia cargada', async () => {
      const { result } = renderHook(() => usePatternEvidence(pattern()));

      await act(async () => {
        await result.current.loadEvidence();
      });
      await act(async () => {
        await result.current.synthesize();
      });

      expect(mockSynthesize).toHaveBeenCalledWith('dawn phenomenon', result.current.evidence);
      expect(result.current.synthesis).toEqual(synthesis);
      expect(result.current.synthesizing).toBe(false);
    });

    it('no llama al modelo si no hay evidencia', async () => {
      const { result } = renderHook(() => usePatternEvidence(pattern()));

      await act(async () => {
        await result.current.synthesize();
      });

      expect(mockSynthesize).not.toHaveBeenCalled();
    });

    it('avisa si la síntesis falla', async () => {
      mockSynthesize.mockRejectedValue(new Error('cuota agotada'));

      const { result } = renderHook(() => usePatternEvidence(pattern()));

      await act(async () => {
        await result.current.loadEvidence();
      });
      await act(async () => {
        await result.current.synthesize();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'cuota agotada');
      expect(result.current.synthesis).toBeNull();
      expect(result.current.synthesizing).toBe(false);
    });
  });
});
