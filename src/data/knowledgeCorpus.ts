import type { KnowledgeCorpusEntry } from "../types";

// Corpus curado de guías clínicas y papers revisados por pares sobre manejo de
// diabetes tipo 1. Cada entrada se embebe con Voyage AI y se usa como base de
// evidencia para las recomendaciones generadas por la app (RAG).
export const KNOWLEDGE_CORPUS: KnowledgeCorpusEntry[] = [];
