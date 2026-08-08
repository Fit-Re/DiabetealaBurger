import { readingsCache, CACHE_TTL, getCacheKeyReadingsSince, getCacheKeyReadingsBetween, getCacheKeyRecentReadings } from '../queryCache';

describe('Query Cache', () => {
  beforeEach(() => {
    readingsCache.clear();
  });

  describe('Cache Key Generation', () => {
    it('should generate unique key for readings since', () => {
      const key1 = getCacheKeyReadingsSince(1000);
      const key2 = getCacheKeyReadingsSince(2000);

      expect(key1).toContain('readings:since:');
      expect(key1).not.toEqual(key2);
    });

    it('should generate unique key for readings between', () => {
      const key1 = getCacheKeyReadingsBetween(1000, 2000);
      const key2 = getCacheKeyReadingsBetween(1000, 3000);

      expect(key1).toContain('readings:between:');
      expect(key1).not.toEqual(key2);
    });

    it('should generate unique key for recent readings', () => {
      const key1 = getCacheKeyRecentReadings(10);
      const key2 = getCacheKeyRecentReadings(20);

      expect(key1).toContain('readings:recent:');
      expect(key1).not.toEqual(key2);
    });
  });

  describe('Set and Get', () => {
    it('should store and retrieve data', () => {
      const key = 'test-key';
      const data = { value: 100, timestamp: Date.now() };

      readingsCache.set(key, data, 60000);
      const retrieved = readingsCache.get(key);

      expect(retrieved).toEqual(data);
    });

    it('should return null for missing key', () => {
      const retrieved = readingsCache.get('nonexistent');

      expect(retrieved).toBeNull();
    });

    it('should handle multiple data types', () => {
      const key1 = 'array';
      const data1 = [1, 2, 3];
      readingsCache.set(key1, data1, 60000);

      const key2 = 'object';
      const data2 = { a: 1, b: 2 };
      readingsCache.set(key2, data2, 60000);

      expect(readingsCache.get(key1)).toEqual(data1);
      expect(readingsCache.get(key2)).toEqual(data2);
    });
  });

  describe('TTL Expiration', () => {
    it('should expire data after TTL', (done) => {
      const key = 'expire-test';
      const data = 'test-data';
      const ttlMs = 100;

      readingsCache.set(key, data, ttlMs);
      expect(readingsCache.get(key)).toEqual(data);

      setTimeout(() => {
        expect(readingsCache.get(key)).toBeNull();
        done();
      }, ttlMs + 50);
    });

    it('should respect different TTL values', (done) => {
      const key1 = 'short-ttl';
      const key2 = 'long-ttl';

      readingsCache.set(key1, 'data1', 100);
      readingsCache.set(key2, 'data2', 500);

      setTimeout(() => {
        expect(readingsCache.get(key1)).toBeNull();
        expect(readingsCache.get(key2)).toEqual('data2');
        done();
      }, 150);
    });

    it('should use cache TTL constants', () => {
      expect(CACHE_TTL.READINGS_QUERY).toBe(5 * 60 * 1000); // 5 minutes
      expect(CACHE_TTL.RECENT_READINGS).toBe(2 * 60 * 1000); // 2 minutes
    });
  });

  describe('Invalidate', () => {
    it('should invalidate single key', () => {
      const key = 'test-key';
      readingsCache.set(key, 'data', 60000);

      readingsCache.invalidate(key);

      expect(readingsCache.get(key)).toBeNull();
    });

    it('should not affect other keys', () => {
      readingsCache.set('key1', 'data1', 60000);
      readingsCache.set('key2', 'data2', 60000);

      readingsCache.invalidate('key1');

      expect(readingsCache.get('key1')).toBeNull();
      expect(readingsCache.get('key2')).toEqual('data2');
    });
  });

  describe('Pattern Invalidation', () => {
    it('should invalidate by regex pattern', () => {
      readingsCache.set('readings:since:1000', 'data1', 60000);
      readingsCache.set('readings:since:2000', 'data2', 60000);
      readingsCache.set('readings:recent:10', 'data3', 60000);

      readingsCache.invalidatePattern(/readings:since:.*/);

      expect(readingsCache.get('readings:since:1000')).toBeNull();
      expect(readingsCache.get('readings:since:2000')).toBeNull();
      expect(readingsCache.get('readings:recent:10')).toEqual('data3');
    });

    it('should invalidate by string pattern', () => {
      readingsCache.set('readings:since:1000', 'data1', 60000);
      readingsCache.set('readings:recent:10', 'data2', 60000);

      readingsCache.invalidatePattern('readings:since');

      expect(readingsCache.get('readings:since:1000')).toBeNull();
      expect(readingsCache.get('readings:recent:10')).toEqual('data2');
    });

    it('should handle wildcard pattern', () => {
      readingsCache.set('readings:since:1000', 'data1', 60000);
      readingsCache.set('readings:between:1000:2000', 'data2', 60000);
      readingsCache.set('readings:recent:10', 'data3', 60000);

      readingsCache.invalidatePattern('readings:.*');

      expect(readingsCache.get('readings:since:1000')).toBeNull();
      expect(readingsCache.get('readings:between:1000:2000')).toBeNull();
      expect(readingsCache.get('readings:recent:10')).toBeNull();
    });
  });

  describe('Clear', () => {
    it('should clear all cache', () => {
      readingsCache.set('key1', 'data1', 60000);
      readingsCache.set('key2', 'data2', 60000);

      readingsCache.clear();

      expect(readingsCache.get('key1')).toBeNull();
      expect(readingsCache.get('key2')).toBeNull();
    });

    it('should allow new data after clear', () => {
      readingsCache.set('key1', 'data1', 60000);
      readingsCache.clear();
      readingsCache.set('key1', 'data2', 60000);

      expect(readingsCache.get('key1')).toEqual('data2');
    });
  });

  describe('Cache Size', () => {
    it('should report cache size', () => {
      readingsCache.clear();
      expect(readingsCache.size()).toBe(0);

      readingsCache.set('key1', 'data1', 60000);
      expect(readingsCache.size()).toBe(1);

      readingsCache.set('key2', 'data2', 60000);
      expect(readingsCache.size()).toBe(2);
    });

    it('should reduce size on invalidation', () => {
      readingsCache.clear();
      readingsCache.set('key1', 'data1', 60000);
      readingsCache.set('key2', 'data2', 60000);

      readingsCache.invalidate('key1');

      expect(readingsCache.size()).toBe(1);
    });
  });
});
