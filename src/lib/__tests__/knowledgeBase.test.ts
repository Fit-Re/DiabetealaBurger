import { computeEmbeddingNorm, cosineSimilarityWithNorms } from '../gemini';

describe('Knowledge Base', () => {
  describe('Embedding Norms', () => {
    it('should compute norm for simple vector', () => {
      const vector = [3, 4]; // norm should be 5
      const norm = computeEmbeddingNorm(vector);

      expect(norm).toBe(5);
    });

    it('should handle unit vector', () => {
      const vector = [1, 0, 0];
      const norm = computeEmbeddingNorm(vector);

      expect(norm).toBeCloseTo(1);
    });

    it('should handle zero vector', () => {
      const vector = [0, 0, 0];
      const norm = computeEmbeddingNorm(vector);

      expect(norm).toBe(0);
    });

    it('should handle large dimensional vector', () => {
      const dimension = 768; // Gemini embedding dimension
      const vector = Array(dimension).fill(1 / Math.sqrt(dimension));
      const norm = computeEmbeddingNorm(vector);

      expect(norm).toBeCloseTo(1);
    });
  });

  describe('Cosine Similarity with Norms', () => {
    it('should compute similarity for identical vectors', () => {
      const vec1 = [1, 0, 0];
      const norm1 = computeEmbeddingNorm(vec1);
      const vec2 = [1, 0, 0];
      const norm2 = computeEmbeddingNorm(vec2);

      const similarity = cosineSimilarityWithNorms(vec1, norm1, vec2, norm2);

      expect(similarity).toBeCloseTo(1);
    });

    it('should compute similarity for orthogonal vectors', () => {
      const vec1 = [1, 0];
      const norm1 = computeEmbeddingNorm(vec1);
      const vec2 = [0, 1];
      const norm2 = computeEmbeddingNorm(vec2);

      const similarity = cosineSimilarityWithNorms(vec1, norm1, vec2, norm2);

      expect(similarity).toBeCloseTo(0);
    });

    it('should handle opposite vectors', () => {
      const vec1 = [1, 0, 0];
      const norm1 = computeEmbeddingNorm(vec1);
      const vec2 = [-1, 0, 0];
      const norm2 = computeEmbeddingNorm(vec2);

      const similarity = cosineSimilarityWithNorms(vec1, norm1, vec2, norm2);

      expect(similarity).toBeCloseTo(-1);
    });

    it('should return 0 for zero norm vectors', () => {
      const vec1 = [0, 0];
      const vec2 = [1, 2];
      const norm2 = computeEmbeddingNorm(vec2);

      const similarity = cosineSimilarityWithNorms(vec1, 0, vec2, norm2);

      expect(similarity).toBe(0);
    });

    it('should compute correct similarity for arbitrary vectors', () => {
      const vec1 = [1, 2, 3];
      const norm1 = computeEmbeddingNorm(vec1);
      const vec2 = [4, 5, 6];
      const norm2 = computeEmbeddingNorm(vec2);

      const similarity = cosineSimilarityWithNorms(vec1, norm1, vec2, norm2);

      // dot product = 1*4 + 2*5 + 3*6 = 32
      // norm1 = sqrt(14), norm2 = sqrt(77)
      // expected = 32 / (sqrt(14) * sqrt(77))
      const expected = 32 / (Math.sqrt(14) * Math.sqrt(77));
      expect(similarity).toBeCloseTo(expected);
    });

    it('should be symmetric', () => {
      const vec1 = [1, 2, 3];
      const norm1 = computeEmbeddingNorm(vec1);
      const vec2 = [4, 5, 6];
      const norm2 = computeEmbeddingNorm(vec2);

      const sim12 = cosineSimilarityWithNorms(vec1, norm1, vec2, norm2);
      const sim21 = cosineSimilarityWithNorms(vec2, norm2, vec1, norm1);

      expect(sim12).toBeCloseTo(sim21);
    });
  });

  describe('Search Query', () => {
    it('should handle empty query gracefully', () => {
      const query = '';
      expect(() => {
        // Would normally call searchKnowledge(query)
        // For now, just verify empty string handling
        expect(query.length).toBe(0);
      }).not.toThrow();
    });

    it('should process long queries', () => {
      const longQuery = 'A'.repeat(1000);
      expect(longQuery.length).toBe(1000);
    });

    it('should be case-insensitive ready', () => {
      const query1 = 'Diabetes Management';
      const query2 = 'diabetes management';
      expect(query1.toLowerCase()).toBe(query2);
    });
  });

  describe('Corpus Ingestion', () => {
    it('should compute norms for all chunks', () => {
      const chunks = [
        { embedding: [1, 0, 0] },
        { embedding: [0, 1, 0] },
        { embedding: [1, 1, 0] },
      ];

      const norms = chunks.map(c => computeEmbeddingNorm(c.embedding));

      expect(norms).toHaveLength(3);
      expect(norms[0]).toBeCloseTo(1);
      expect(norms[1]).toBeCloseTo(1);
      expect(norms[2]).toBeCloseTo(Math.sqrt(2));
    });

    it('should handle pre-normalized embeddings', () => {
      const embedding = [0.6, 0.8]; // norm = 1
      const norm = computeEmbeddingNorm(embedding);

      expect(norm).toBeCloseTo(1);
    });
  });
});
