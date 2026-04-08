import { DictionaryEntry } from '../AgenticBackendClient';

const CANONICAL_TOKENS = [
  'if',
  'else',
  'for each',
  'return',
  'assign',
  'print',
  'call',
  'function',
  'pass',
  'is empty',
  'is not empty',
  'is greater than',
  'is less than',
  'is equal to',
  'is not equal to',
  'is within',
  'is in',
  'is not in'
];

export function getDictionaryLearningPrompt(corpus: string): { system: string; user: string } {
  const system = [
    'You are a compiler lexicon builder.',
    'Extract pseudocode phrase variants and map each one to exactly one canonical token.',
    'Output strict JSON array only. No markdown.',
    'Each element: {"term":"...","canonical":"...","confidence":0.0-1.0}.',
    `Canonical tokens allowed: ${CANONICAL_TOKENS.join(', ')}`
  ].join(' ');

  const user = [
    'Build a mapping dictionary from this corpus to canonical tokens.',
    'Keep only useful compiler words/phrases. Ignore identifiers and literals.',
    'Corpus:',
    corpus.slice(0, 20000)
  ].join('\n');

  return { system, user };
}

export function getPairDictionaryLearningPrompt(
  pseudocode: string,
  generatedCode: string,
  language: string
): { system: string; user: string } {
  const system = [
    'You are a compiler lexicon builder for deterministic transpilation.',
    'Infer phrase mappings from pseudocode to canonical compiler tokens.',
    'Output strict JSON array only. No markdown.',
    'Each element: {"term":"...","canonical":"...","confidence":0.0-1.0}.',
    `Canonical tokens allowed: ${CANONICAL_TOKENS.join(', ')}`
  ].join(' ');

  const user = [
    `Target language: ${language}`,
    'Infer useful pseudocode phrase variants from this pair.',
    'Keep only lexical/structural terms (not variable names, literals, class names).',
    'Pseudocode:',
    pseudocode.slice(0, 8000),
    'Generated code:',
    generatedCode.slice(0, 8000)
  ].join('\n');

  return { system, user };
}

export function parseDictionaryEntries(raw: string): DictionaryEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const entries: DictionaryEntry[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const term = String((item as any).term || '').trim().toLowerCase();
    const canonical = String((item as any).canonical || '').trim().toLowerCase();
    const confidenceRaw = Number((item as any).confidence ?? 0.7);
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.min(1, Math.max(0, confidenceRaw))
      : 0.7;

    if (!term || !canonical || !CANONICAL_TOKENS.includes(canonical)) {
      continue;
    }

    entries.push({ term, canonical, confidence, source: 'ai-scrape' });
  }

  return dedupe(entries);
}

export function buildHeuristicEntries(): DictionaryEntry[] {
  const seed: Array<[string, string]> = [
    ['when', 'if'],
    ['otherwise', 'else'],
    ['loop through', 'for each'],
    ['iterate', 'for each'],
    ['output', 'print'],
    ['display', 'print'],
    ['invoke', 'call'],
    ['define function', 'function'],
    ['set', 'assign'],
    ['equals', 'is equal to'],
    ['greater than', 'is greater than'],
    ['less than', 'is less than'],
    ['inside', 'is within'],
    ['contains', 'is in']
  ];

  return seed.map(([term, canonical]) => ({
    term,
    canonical,
    confidence: 0.65,
    source: 'heuristic-seed'
  }));
}

export function applyDictionaryToPseudocode(text: string, entries: DictionaryEntry[]): string {
  let out = text;
  const sorted = [...entries]
    .filter((x) => x.term && x.canonical)
    .sort((a, b) => b.term.length - a.term.length);

  for (const entry of sorted) {
    const escaped = escapeRegex(entry.term);
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    out = out.replace(regex, entry.canonical);
  }

  return out;
}

function dedupe(entries: DictionaryEntry[]): DictionaryEntry[] {
  const map = new Map<string, DictionaryEntry>();
  for (const item of entries) {
    const key = item.term.toLowerCase();
    const existing = map.get(key);
    if (!existing || (item.confidence || 0) > (existing.confidence || 0)) {
      map.set(key, item);
    }
  }
  return [...map.values()];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
