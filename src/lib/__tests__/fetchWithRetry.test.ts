import { fetchWithRetry } from '../fetchWithRetry';

describe('fetchWithRetry', () => {
  let mockFetch: jest.Mock;

  // Backoff mínimo: los tests verifican que se reintenta, no cuánto se espera.
  // Con el backoff real (1s, 2s, 4s...) la suite excede el timeout de Jest.
  const fastRetry = { initialBackoffMs: 1, maxBackoffMs: 1 };

  beforeEach(() => {
    mockFetch = global.fetch as jest.Mock;
    // mockReset (no clearAllMocks) porque hay que vaciar también las colas de
    // mockResolvedValueOnce; si no, las respuestas sobrantes de un test que
    // falla se filtran al siguiente.
    mockFetch.mockReset();
  });

  describe('Success Cases', () => {
    it('should succeed on first attempt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValueOnce('OK'),
      });

      const response = await fetchWithRetry('https://api.example.com/data', {
        method: 'GET',
      });

      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle successful response with timeout option', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValueOnce('OK'),
      });

      const response = await fetchWithRetry(
        'https://api.example.com/data',
        { method: 'GET' },
        { timeoutMs: 30000 }
      );

      expect(response.ok).toBe(true);
    });
  });

  describe('Transient Error Retries', () => {
    it('should retry on 429 (rate limit)', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: jest.fn().mockResolvedValueOnce('Rate limited'),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: jest.fn().mockResolvedValueOnce('OK'),
        });

      const response = await fetchWithRetry(
        'https://api.example.com/data',
        { method: 'GET' },
        fastRetry
      );

      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 503 (service unavailable)', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: jest.fn().mockResolvedValueOnce('Service unavailable'),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: jest.fn().mockResolvedValueOnce('OK'),
        });

      const response = await fetchWithRetry(
        'https://api.example.com/data',
        { method: 'GET' },
        fastRetry
      );

      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry up to max attempts on transient errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: jest.fn().mockResolvedValueOnce('Unavailable'),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: jest.fn().mockResolvedValueOnce('Unavailable'),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: jest.fn().mockResolvedValueOnce('Unavailable'),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: jest.fn().mockResolvedValueOnce('OK'),
        });

      const response = await fetchWithRetry(
        'https://api.example.com/data',
        { method: 'GET' },
        { ...fastRetry, maxAttempts: 4 }
      );

      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('Non-Transient Errors', () => {
    it('should not retry on 400 (bad request)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValueOnce('Bad request'),
      });

      const response = await fetchWithRetry('https://api.example.com/data', {
        method: 'GET',
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 401 (unauthorized)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValueOnce('Unauthorized'),
      });

      const response = await fetchWithRetry('https://api.example.com/data', {
        method: 'GET',
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 403 (forbidden)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: jest.fn().mockResolvedValueOnce('Forbidden'),
      });

      const response = await fetchWithRetry('https://api.example.com/data', {
        method: 'GET',
      });

      expect(response.ok).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 404 (not found)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValueOnce('Not found'),
      });

      const response = await fetchWithRetry('https://api.example.com/data', {
        method: 'GET',
      });

      expect(response.ok).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      // Falla en todos los intentos: fetchWithRetry agota los reintentos y lanza.
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        fetchWithRetry('https://api.example.com/data', { method: 'GET' }, fastRetry)
      ).rejects.toThrow(/Network error/);

      expect(mockFetch).toHaveBeenCalledTimes(4); // DEFAULT_MAX_ATTEMPTS
    });

    it('should respect timeout', async () => {
      // El mock respeta el AbortSignal igual que fetch real: sin esto la promesa
      // nunca se resuelve y el propio test agota el timeout de Jest.
      mockFetch.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new Error('The operation was aborted'))
            );
          })
      );

      await expect(
        fetchWithRetry(
          'https://api.example.com/data',
          { method: 'GET' },
          { ...fastRetry, timeoutMs: 10 }
        )
      ).rejects.toThrow(/aborted/);
    });

    it('should fail after max retries', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        text: jest.fn().mockResolvedValueOnce('Service unavailable'),
      });

      const response = await fetchWithRetry(
        'https://api.example.com/data',
        { method: 'GET' },
        { ...fastRetry, maxAttempts: 2 }
      );

      expect(response.ok).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
