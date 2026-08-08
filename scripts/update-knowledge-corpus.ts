#!/usr/bin/env node

/**
 * Quarterly Knowledge Corpus Update Script
 *
 * Fetches latest medical guidelines and papers on diabetes management from PubMed
 * and generates updated knowledgeCorpus.ts.
 *
 * Usage:
 *   npx ts-node scripts/update-knowledge-corpus.ts --year 2026 --quarter 3
 */

import https from "https";
import { URL } from "url";

interface PubMedArticle {
  pmid: string;
  title: string;
  authors: string;
  year: number | null;
  journal: string;
  url: string;
  abstract: string;
}

interface CorpusEntry {
  id: string;
  title: string;
  authors: string;
  year: number;
  source: string;
  url: string;
  topic: string;
  summary: string;
}

// Topics to search for in quarterly updates
const TOPICS_TO_UPDATE = [
  {
    query: "continuous glucose monitoring diabetes guidelines 2024 2025 2026",
    topic: "cgm_targets",
  },
  {
    query: "glycemic targets diabetes children adolescents 2024 2025 2026",
    topic: "cgm_targets",
  },
  {
    query: "dawn phenomenon diabetes management 2024 2025",
    topic: "dawn_phenomenon",
  },
  {
    query: "insulin pump therapy type 1 diabetes 2024 2025 2026",
    topic: "insulin_therapy",
  },
  {
    query: "GLP-1 agonist type 1 diabetes 2024 2025",
    topic: "medication_therapy",
  },
  {
    query: "closed loop system artificial pancreas diabetes 2024 2025 2026",
    topic: "technology",
  },
  {
    query: "time in range targets diabetes ADA ISPAD 2024 2025 2026",
    topic: "cgm_targets",
  },
];

async function fetchFromPubMed(query: string, maxResults: number = 5): Promise<PubMedArticle[]> {
  return new Promise((resolve, reject) => {
    const searchParams = new URLSearchParams({
      db: "pubmed",
      term: query,
      retmax: String(maxResults),
      sort: "pub_date",
      retmode: "json",
    });

    const url = new URL(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams}`);

    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            const ids: string[] = json?.esearchresult?.idlist ?? [];
            if (ids.length === 0) {
              resolve([]);
              return;
            }

            // Fetch full details
            const fetchParams = new URLSearchParams({
              db: "pubmed",
              id: ids.join(","),
              rettype: "abstract",
              retmode: "xml",
            });
            const fetchUrl = new URL(
              `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${fetchParams}`
            );

            https
              .get(fetchUrl, (res2) => {
                let xml = "";
                res2.on("data", (chunk) => {
                  xml += chunk;
                });
                res2.on("end", () => {
                  const articles = parseXML(xml);
                  resolve(articles);
                });
              })
              .on("error", reject);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

function extractTag(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(xml);
  return match ? match[1].replace(/<[^>]+>/g, "").trim() : null;
}

function extractAllTags(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g");
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].replace(/<[^>]+>/g, "").trim());
  }
  return results;
}

function parseXML(xml: string): PubMedArticle[] {
  const articleBlocks = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) ?? [];
  return articleBlocks
    .map((block) => {
      const pmid = extractTag(block, "PMID");
      if (!pmid) return null;

      const title = extractTag(block, "ArticleTitle") ?? "(sin título)";
      const abstractParts = extractAllTags(block, "AbstractText");
      const abstract = abstractParts.join(" ").trim();
      const year = extractTag(block, "PubDate") ? extractTag(block, "Year") : null;
      const journal = extractTag(block, "Title") ?? extractTag(block, "ISOAbbreviation") ?? "";
      const lastNames = extractAllTags(block, "LastName");
      let authors = lastNames.slice(0, 3).join(", ");
      if (lastNames.length > 3) authors += ", et al.";
      if (!authors) authors = "Author not available";

      return {
        pmid,
        title,
        authors,
        year: year ? Number(year) : null,
        journal,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        abstract,
      };
    })
    .filter((a): a is PubMedArticle => a !== null && a.abstract.length > 0);
}

function generateCorpusEntry(article: PubMedArticle, topic: string, index: number): CorpusEntry {
  const slug = `${article.authors.split(",")[0].toLowerCase().replace(/[^a-z0-9]/g, "")}-${article.year}-${topic}-${index}`;
  return {
    id: slug,
    title: article.title,
    authors: article.authors,
    year: article.year ?? 0,
    source: article.journal,
    url: article.url,
    topic,
    summary: article.abstract.slice(0, 500),
  };
}

async function main() {
  console.log("🔍 Updating Knowledge Corpus from PubMed...\n");

  const allArticles: CorpusEntry[] = [];

  for (const { query, topic } of TOPICS_TO_UPDATE) {
    console.log(`📚 Searching: "${query}"`);
    try {
      const articles = await fetchFromPubMed(query, 5);
      console.log(`   Found ${articles.length} articles`);

      articles.forEach((article, i) => {
        const entry = generateCorpusEntry(article, topic, i);
        allArticles.push(entry);
      });
    } catch (e) {
      console.error(`   ❌ Error: ${e}`);
    }

    // Delay between requests to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Remove duplicates by PMID
  const uniqueByPmid = new Map<string, CorpusEntry>();
  allArticles.forEach((entry) => {
    const pmid = entry.url.split("/").pop();
    if (pmid && !uniqueByPmid.has(pmid)) {
      uniqueByPmid.set(pmid, entry);
    }
  });

  const unique = Array.from(uniqueByPmid.values());

  // Generate TypeScript code
  const tsCode = `import type { KnowledgeCorpusEntry } from "../types";

// Auto-generated Knowledge Corpus — Updated quarterly
// Generated: ${new Date().toISOString()}
//
// Contains recent medical literature on diabetes management from PubMed.
// Updated quarterly to maintain currency with latest guidelines.
export const KNOWLEDGE_CORPUS: KnowledgeCorpusEntry[] = [
${unique
  .map(
    (entry) => `  {
    id: "${entry.id}",
    title: "${entry.title.replace(/"/g, '\\"')}",
    authors: "${entry.authors.replace(/"/g, '\\"')}",
    year: ${entry.year},
    source: "${entry.source.replace(/"/g, '\\"')}",
    url: "${entry.url}",
    topic: "${entry.topic}",
    summary: "${entry.summary.replace(/"/g, '\\"').slice(0, 500)}",
  }`
  )
  .join(",\n")}
];
`;

  console.log(`\n✅ Generated corpus with ${unique.length} entries`);
  console.log("\nTo apply, run:");
  console.log("  cp /tmp/knowledge-corpus-updated.ts src/data/knowledgeCorpus.ts");
  console.log("  git add src/data/knowledgeCorpus.ts");
  console.log("  git commit -m 'chore: update knowledge corpus with latest medical literature'");

  // Write to temp file
  require("fs").writeFileSync("/tmp/knowledge-corpus-updated.ts", tsCode);
  console.log("\n📄 Output written to: /tmp/knowledge-corpus-updated.ts");
}

main().catch(console.error);
