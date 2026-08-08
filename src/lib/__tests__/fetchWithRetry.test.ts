import { fetchWithRetry } from '../fetchWithRetry';

describe('fetchWithRetry', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = global.fetch as jest.Mock;
    jest.clearAllMocks();
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

      const response = await fetchWithRetry('https://api.example.com/data', {
        method: 'GET',
      });

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

      const response = await fetchWithRetry('https://api.example.com/data', {
        method: 'GET',
      });

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
        { maxAttempts: 4 }
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
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        fetchWithRetry('https://api.example.com/data', { method: 'GET' })
      ).rejects.toThrow();
    });

    it('should respect timeout', async () => {
      mockFetch.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100000))
      );

      await expect(
        fetchWithRetry(
          'https://api.example.com/data',
          { method: 'GET' },
          { timeoutMs: 100 }
        )
      ).rejects.toThrow();
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
        { maxAttempts: 2 }
      );

      expect(response.ok).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
