/**
 * Pure, side-effect-free helpers extracted from documentController's AI parsing
 * pipeline. Nothing here touches Mongo, the network, or the filesystem, so it
 * can be unit-tested directly.
 *
 * Extracting these was a prerequisite for the Phase 2 test work (see
 * docs/ARCHITECTURE_AND_ROADMAP.md, F-06) — the highest-churn logic in the
 * codebase was the least reachable from a test.
 */

/** Chunker defaults: 250-line windows with a 50-line overlap between them. */
const MAX_CHUNK_SIZE = 250;
const OVERLAP_SIZE = 50;

/** Page marker injected by the PDF renderer, stripped before line indexing. */
const PAGE_MARKER = /___PAGE_START_(\d+)___/;
const PAGE_MARKER_GLOBAL = /___PAGE_START_\d+___/g;

/** Model families that cannot do structured text extraction for us. */
const UNSUPPORTED_MODEL_KEYWORDS = [
  'embedding', 'imagen', 'veo', 'tts', 'audio',
  'aqa', 'research', 'antigravity', 'robotics', 'computer-use',
];

/** Used when models.list() is unavailable or yields nothing usable. */
const FALLBACK_MODELS = [
  'gemini-2.5-pro',
  'gemini-1.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

/**
 * Rank a model name for suitability. Higher is better; anything at or below
 * -50 is treated as unusable and dropped by rankModels().
 */
function getScore(name) {
  let score = 0;
  if (name.includes('3.1') || name.includes('3.0') || name.includes('3-pro')) return -100;
  if (name.includes('2.5-flash')) score += 100;
  else if (name.includes('2.0-flash')) score += 80;
  else if (name.includes('1.5-flash')) score += 50;
  else if (name.includes('pro')) score += 20;

  if (!name.includes('preview') && !name.includes('exp')) score += 10;
  if (name.includes('lite') || name.includes('8b')) score -= 10;
  return score;
}

/** True if the model is a Gemini/Gemma text model we can prompt. */
function isSupportedModel(name) {
  if (UNSUPPORTED_MODEL_KEYWORDS.some((keyword) => name.includes(keyword))) return false;
  return name.includes('gemini') || name.includes('gemma');
}

/**
 * Filter a raw model-name list down to usable candidates, best first.
 * The result doubles as the fallback order: index 0 is tried, then index 1, etc.
 */
function rankModels(names) {
  return names
    .filter(isSupportedModel)
    .filter((name) => getScore(name) > -50)
    .sort((a, b) => getScore(b) - getScore(a));
}

/**
 * Turn extracted document text into a line dictionary plus the line-numbered
 * text handed to the model.
 *
 * The model is asked to return line *indexes* rather than text, and the server
 * reassembles the text from this dictionary — so the AI can never mistranscribe
 * a question. Page markers are consumed here and recorded per line, which is
 * where question page-provenance comes from for free.
 *
 * Blank lines are dropped and do not consume an index.
 */
function buildLineDictionary(extractedText) {
  const dictionary = {};
  const textLinesWithIndex = [];
  let currentLineIndex = 1;
  let currentPage = '1';

  for (const line of extractedText.split('\n')) {
    const pageMatch = line.match(PAGE_MARKER);
    if (pageMatch) {
      currentPage = pageMatch[1];
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed) continue;

    dictionary[currentLineIndex] = { text: trimmed, page: currentPage };
    textLinesWithIndex.push(`[${currentLineIndex}] ${trimmed}`);
    currentLineIndex++;
  }

  return { dictionary, textLinesWithIndex };
}

/** Strip page markers to decide whether a PDF actually carried any text. */
function stripPageMarkers(text) {
  return text.replace(PAGE_MARKER_GLOBAL, '').trim();
}

/** Derive a display page range ("4" or "4-7") from a set of line indexes. */
function derivePageRange(indexes, dictionary) {
  const pages = [...new Set(indexes.map((idx) => dictionary[idx]?.page).filter(Boolean))];
  if (pages.length === 0) return null;
  if (pages.length === 1) return pages[0];
  return `${pages[0]}-${pages[pages.length - 1]}`;
}

/**
 * Split line-numbered text into overlapping chunks. The overlap exists so a
 * question straddling a chunk boundary is seen whole by at least one chunk;
 * the resulting duplicates are removed later by question_text dedup.
 */
function chunkIndexedLines(textLinesWithIndex, dictionary, options = {}) {
  const maxChunkSize = options.maxChunkSize ?? MAX_CHUNK_SIZE;
  const overlapSize = options.overlapSize ?? OVERLAP_SIZE;
  const stride = maxChunkSize - overlapSize;
  const chunks = [];

  for (let i = 0; i < textLinesWithIndex.length; i += stride) {
    const chunkLines = textLinesWithIndex.slice(i, i + maxChunkSize);
    if (chunkLines.length === 0) continue;

    let pageRange = null;
    const firstMatch = chunkLines[0].match(/^\[(\d+)\]/);
    const lastMatch = chunkLines[chunkLines.length - 1].match(/^\[(\d+)\]/);
    if (firstMatch && lastMatch) {
      const firstPage = dictionary[firstMatch[1]]?.page;
      const lastPage = dictionary[lastMatch[1]]?.page;
      if (firstPage && lastPage) {
        pageRange = firstPage === lastPage ? String(firstPage) : `${firstPage}-${lastPage}`;
      }
    }
    chunks.push({ text: chunkLines.join('\n'), isTextIndex: true, pageRange });
  }

  return chunks;
}

/**
 * Rebuild one question from the model's line-index answer.
 *
 * Returns null when the answer is unusable (no question lines, fewer than two
 * options, or no option flagged correct) so the caller can drop it.
 */
function reassembleQuestion(q, dictionary) {
  if (!q.question_lines || q.question_lines.length === 0) return null;
  if (!q.options || q.options.length < 2) return null;

  const correctOpt = q.options.find((o) => o.is_correct);
  if (!correctOpt) return null;

  const getText = (indexes) => {
    if (!indexes) return '';
    return indexes.map((idx) => dictionary[idx]?.text || '').filter(Boolean).join('\n');
  };

  const allIdxs = [...(q.context_lines || []), ...q.question_lines];
  q.options.forEach((o) => allIdxs.push(...(o.lines || [])));
  allIdxs.push(...(q.explanation_lines || []));

  return {
    topic: q.topic || 'General',
    subtopic: q.subtopic || 'General',
    context: getText(q.context_lines),
    question_text: getText(q.question_lines),
    options: q.options.map((o) => getText(o.lines)),
    correct_answer: getText(correctOpt.lines),
    explanation: getText(q.explanation_lines),
    pageRange: derivePageRange(allIdxs, dictionary),
  };
}

/**
 * Validate a question returned by the flat (image-PDF) schema, where the model
 * hands back literal text because there are no line indexes to reference.
 */
function isValidFlatQuestion(q) {
  const hasOptions = Array.isArray(q.options) && q.options.length >= 2;
  const hasCorrect = hasOptions && q.options.some((opt) => opt.trim() === (q.correct_answer || '').trim());
  return Boolean(q.topic && q.subtopic && q.question_text && hasOptions && hasCorrect && q.explanation);
}

/** Drop repeats introduced by chunk overlap, keeping the first occurrence. */
function dedupeByQuestionText(questions) {
  const uniqueMap = new Map();
  for (const q of questions) {
    if (!uniqueMap.has(q.question_text)) {
      uniqueMap.set(q.question_text, q);
    }
  }
  return Array.from(uniqueMap.values());
}

module.exports = {
  MAX_CHUNK_SIZE,
  OVERLAP_SIZE,
  FALLBACK_MODELS,
  getScore,
  isSupportedModel,
  rankModels,
  buildLineDictionary,
  stripPageMarkers,
  derivePageRange,
  chunkIndexedLines,
  reassembleQuestion,
  isValidFlatQuestion,
  dedupeByQuestionText,
};
