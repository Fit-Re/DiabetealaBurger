import { getWithRetry } from "./fetchWithRetry";

const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

export interface PubMedArticle {
  pmid: string;
  title: string;
  authors: string;
  year: number | null;
  journal: string;
  url: string;
  abstract: string;
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

function parseArticle(xml: string): PubMedArticle | null {
  const pmid = extractTag(xml, "PMID");
  if (!pmid) return null;

  const title = extractTag(xml, "ArticleTitle") ?? "(sin título)";

  const abstractParts = extractAllTags(xml, "AbstractText");
  const abstract = abstractParts.join(" ").trim();

  const year = extractTag(xml, "PubDate") ? extractTag(xml, "Year") : null;

  const journal = extractTag(xml, "Title") ?? extractTag(xml, "ISOAbbreviation") ?? "";

  const lastNames = extractAllTags(xml, "LastName");
  let authors = lastNames.slice(0, 3).join(", ");
  if (lastNames.length > 3) authors += ", et al.";
  if (!authors) authors = "Autor no disponible";

  return {
    pmid,
    title,
    authors,
    year: year ? Number(year) : null,
    journal,
    url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    abstract,
  };
}

export async function searchPubMedLive(
  query: string,
  maxResults: number = 3
): Promise<PubMedArticle[]> {
  const searchParams = new URLSearchParams({
    db: "pubmed",
    term: query,
    retmax: String(maxResults),
    sort: "relevance",
    retmode: "json",
  });
  const searchResponse = await getWithRetry(`${EUTILS_BASE}/esearch.fcgi?${searchParams}`);
  if (!searchResponse.ok) {
    throw new Error(`Error al buscar en PubMed (${searchResponse.status})`);
  }
  const searchJson = await searchResponse.json();
  const ids: string[] = searchJson?.esearchresult?.idlist ?? [];
  if (ids.length === 0) return [];

  const fetchParams = new URLSearchParams({
    db: "pubmed",
    id: ids.join(","),
    rettype: "abstract",
    retmode: "xml",
  });
  const fetchResponse = await getWithRetry(`${EUTILS_BASE}/efetch.fcgi?${fetchParams}`);
  if (!fetchResponse.ok) {
    throw new Error(`Error al obtener artículos de PubMed (${fetchResponse.status})`);
  }
  const xml = await fetchResponse.text();

  const articleBlocks = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) ?? [];
  return articleBlocks
    .map(parseArticle)
    .filter((a): a is PubMedArticle => a !== null && a.abstract.length > 0);
}
