/**
 * Unit tests for the pure parsing helpers extracted from documentController.
 *
 * These cover the logic F-06 flagged as entirely untested: model ranking, the
 * chunker's overlap and page-range derivation, and line-index reassembly.
 * No database, no network — this file does not need the Mongo harness.
 */
const {
  MAX_CHUNK_SIZE,
  OVERLAP_SIZE,
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
} = require('../src/services/documentParsing');

// ─── Model ranking ─────────────────────────────────────
describe('getScore', () => {
  it('ranks 2.5-flash above 2.0-flash above 1.5-flash', () => {
    expect(getScore('gemini-2.5-flash')).toBeGreaterThan(getScore('gemini-2.0-flash'));
    expect(getScore('gemini-2.0-flash')).toBeGreaterThan(getScore('gemini-1.5-flash'));
  });

  it('disqualifies 3.x models outright', () => {
    // These exist in models.list() but are not usable here; -100 puts them
    // below the -50 cutoff rankModels applies.
    expect(getScore('gemini-3.0-pro')).toBe(-100);
    expect(getScore('gemini-3.1-flash')).toBe(-100);
    expect(getScore('gemini-3-pro-preview')).toBe(-100);
  });

  it('prefers stable models over preview and exp builds', () => {
    expect(getScore('gemini-2.5-flash')).toBeGreaterThan(getScore('gemini-2.5-flash-preview'));
    expect(getScore('gemini-2.5-flash')).toBeGreaterThan(getScore('gemini-2.5-flash-exp'));
  });

  it('penalises lite and 8b variants', () => {
    expect(getScore('gemini-2.0-flash-lite')).toBeLessThan(getScore('gemini-2.0-flash'));
    expect(getScore('gemini-1.5-flash-8b')).toBeLessThan(getScore('gemini-1.5-flash'));
  });
});

describe('isSupportedModel', () => {
  it('accepts gemini and gemma text models', () => {
    expect(isSupportedModel('gemini-2.5-flash')).toBe(true);
    expect(isSupportedModel('gemma-3-27b-it')).toBe(true);
  });

  it.each([
    'text-embedding-004',
    'imagen-3.0-generate',
    'veo-2.0-generate',
    'gemini-2.5-flash-tts',
    'gemini-2.0-flash-audio',
    'aqa',
    'gemini-robotics-er',
    'gemini-2.5-computer-use',
  ])('rejects non-text model %s', (name) => {
    expect(isSupportedModel(name)).toBe(false);
  });

  it('rejects unrelated models', () => {
    expect(isSupportedModel('some-other-model')).toBe(false);
  });
});

describe('rankModels', () => {
  it('filters, then orders best-first', () => {
    const ranked = rankModels([
      'text-embedding-004',
      'gemini-1.5-flash',
      'gemini-3.0-pro',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'imagen-3.0-generate',
    ]);

    expect(ranked).toEqual([
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ]);
  });

  it('returns an empty list when nothing is usable', () => {
    expect(rankModels(['text-embedding-004', 'gemini-3.0-pro'])).toEqual([]);
  });

  it('does not mutate its input', () => {
    const input = ['gemini-1.5-flash', 'gemini-2.5-flash'];
    rankModels(input);
    expect(input).toEqual(['gemini-1.5-flash', 'gemini-2.5-flash']);
  });
});

// ─── Line dictionary ───────────────────────────────────
describe('buildLineDictionary', () => {
  it('indexes non-blank lines from 1 and emits [N] text', () => {
    const { dictionary, textLinesWithIndex } = buildLineDictionary('First\n\n  Second  \nThird');

    expect(textLinesWithIndex).toEqual(['[1] First', '[2] Second', '[3] Third']);
    expect(dictionary[1]).toEqual({ text: 'First', page: '1' });
    expect(dictionary[2].text).toBe('Second');
  });

  it('does not spend an index on a blank line', () => {
    const { dictionary } = buildLineDictionary('A\n\n\n\nB');
    expect(Object.keys(dictionary)).toEqual(['1', '2']);
    expect(dictionary[2].text).toBe('B');
  });

  it('attributes lines to the page marker that precedes them', () => {
    const text = [
      '___PAGE_START_1___',
      'on page one',
      '___PAGE_START_2___',
      'on page two',
      'also page two',
    ].join('\n');

    const { dictionary } = buildLineDictionary(text);

    expect(dictionary[1]).toEqual({ text: 'on page one', page: '1' });
    expect(dictionary[2].page).toBe('2');
    expect(dictionary[3].page).toBe('2');
  });

  it('consumes page markers rather than indexing them', () => {
    const { textLinesWithIndex } = buildLineDictionary('___PAGE_START_7___\nreal text');
    expect(textLinesWithIndex).toEqual(['[1] real text']);
  });

  it('handles empty input', () => {
    expect(buildLineDictionary('')).toEqual({ dictionary: {}, textLinesWithIndex: [] });
  });
});

describe('stripPageMarkers', () => {
  it('leaves nothing behind for a page-marker-only (image) PDF', () => {
    expect(stripPageMarkers('\n___PAGE_START_1___\n\n___PAGE_START_2___\n')).toBe('');
  });

  it('keeps real text', () => {
    expect(stripPageMarkers('___PAGE_START_1___\nhello')).toBe('hello');
  });
});

// ─── Chunking ──────────────────────────────────────────
describe('chunkIndexedLines', () => {
  const makeLines = (n) => Array.from({ length: n }, (_, i) => `[${i + 1}] line ${i + 1}`);
  const makeDict = (n, page = '1') =>
    Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, { text: `line ${i + 1}`, page }]));

  it('returns a single chunk when the document fits in one window', () => {
    const chunks = chunkIndexedLines(makeLines(10), makeDict(10));
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text.split('\n')).toHaveLength(10);
    expect(chunks[0].isTextIndex).toBe(true);
  });

  it('advances by (maxChunkSize - overlapSize) so chunks overlap', () => {
    const chunks = chunkIndexedLines(makeLines(500), makeDict(500));

    // stride = 250 - 50 = 200
    expect(chunks[0].text.startsWith('[1] ')).toBe(true);
    expect(chunks[1].text.startsWith('[201] ')).toBe(true);
    expect(chunks[2].text.startsWith('[401] ')).toBe(true);
  });

  it('overlaps consecutive chunks by exactly OVERLAP_SIZE lines', () => {
    const chunks = chunkIndexedLines(makeLines(500), makeDict(500));
    const first = new Set(chunks[0].text.split('\n'));
    const second = chunks[1].text.split('\n');
    const shared = second.filter((line) => first.has(line));

    expect(shared).toHaveLength(OVERLAP_SIZE);
  });

  it('caps each chunk at MAX_CHUNK_SIZE lines', () => {
    const chunks = chunkIndexedLines(makeLines(500), makeDict(500));
    for (const chunk of chunks) {
      expect(chunk.text.split('\n').length).toBeLessThanOrEqual(MAX_CHUNK_SIZE);
    }
  });

  it('covers every line at least once', () => {
    const chunks = chunkIndexedLines(makeLines(437), makeDict(437));
    const seen = new Set(chunks.flatMap((c) => c.text.split('\n')));
    expect(seen.size).toBe(437);
  });

  it('honours custom window and overlap sizes', () => {
    const chunks = chunkIndexedLines(makeLines(10), makeDict(10), { maxChunkSize: 4, overlapSize: 1 });

    // stride 3 → windows at 1, 4, 7, 10
    expect(chunks).toHaveLength(4);
    expect(chunks[0].text.split('\n')).toHaveLength(4);
    expect(chunks[3].text).toBe('[10] line 10');
  });

  it('reports a single page as a bare number', () => {
    const chunks = chunkIndexedLines(makeLines(5), makeDict(5, '3'));
    expect(chunks[0].pageRange).toBe('3');
  });

  it('reports a span as first-last', () => {
    const dict = { ...makeDict(3, '4'), 4: { text: 'line 4', page: '9' } };
    const chunks = chunkIndexedLines(makeLines(4), dict);
    expect(chunks[0].pageRange).toBe('4-9');
  });

  it('returns no chunks for an empty document', () => {
    expect(chunkIndexedLines([], {})).toEqual([]);
  });
});

describe('derivePageRange', () => {
  const dict = {
    1: { text: 'a', page: '2' },
    2: { text: 'b', page: '2' },
    3: { text: 'c', page: '5' },
  };

  it('collapses a single page to a bare number', () => {
    expect(derivePageRange([1, 2], dict)).toBe('2');
  });

  it('spans first to last across pages', () => {
    expect(derivePageRange([1, 2, 3], dict)).toBe('2-5');
  });

  it('returns null when no index resolves', () => {
    expect(derivePageRange([99], dict)).toBeNull();
    expect(derivePageRange([], dict)).toBeNull();
  });
});

// ─── Line-index reassembly ─────────────────────────────
describe('reassembleQuestion', () => {
  const dictionary = {
    1: { text: 'Read the passage below.', page: '1' },
    2: { text: 'What is the capital of France?', page: '1' },
    3: { text: 'Paris', page: '1' },
    4: { text: 'London', page: '1' },
    5: { text: 'Paris has been the capital since 987.', page: '2' },
  };

  const answer = () => ({
    topic: 'Geography',
    subtopic: 'Europe',
    context_lines: [1],
    question_lines: [2],
    options: [
      { lines: [3], is_correct: true },
      { lines: [4], is_correct: false },
    ],
    explanation_lines: [5],
  });

  it('rebuilds text from the server-side dictionary, not from the model', () => {
    const q = reassembleQuestion(answer(), dictionary);

    expect(q.context).toBe('Read the passage below.');
    expect(q.question_text).toBe('What is the capital of France?');
    expect(q.options).toEqual(['Paris', 'London']);
    expect(q.correct_answer).toBe('Paris');
    expect(q.explanation).toBe('Paris has been the capital since 987.');
  });

  it('derives the page range from every line the question touches', () => {
    expect(reassembleQuestion(answer(), dictionary).pageRange).toBe('1-2');
  });

  it('joins multi-line fields with newlines', () => {
    const a = answer();
    a.question_lines = [1, 2];
    expect(reassembleQuestion(a, dictionary).question_text)
      .toBe('Read the passage below.\nWhat is the capital of France?');
  });

  it('ignores line indexes that are not in the dictionary', () => {
    const a = answer();
    a.question_lines = [2, 999];
    expect(reassembleQuestion(a, dictionary).question_text).toBe('What is the capital of France?');
  });

  it('defaults a missing topic and subtopic to General', () => {
    const a = answer();
    delete a.topic;
    delete a.subtopic;
    const q = reassembleQuestion(a, dictionary);
    expect(q.topic).toBe('General');
    expect(q.subtopic).toBe('General');
  });

  it('treats absent context and explanation as empty strings', () => {
    const a = answer();
    delete a.context_lines;
    delete a.explanation_lines;
    const q = reassembleQuestion(a, dictionary);
    expect(q.context).toBe('');
    expect(q.explanation).toBe('');
  });

  it('rejects an answer with no question lines', () => {
    const a = answer();
    a.question_lines = [];
    expect(reassembleQuestion(a, dictionary)).toBeNull();
  });

  it('rejects an answer with fewer than two options', () => {
    const a = answer();
    a.options = [{ lines: [3], is_correct: true }];
    expect(reassembleQuestion(a, dictionary)).toBeNull();
  });

  it('rejects an answer where no option is flagged correct', () => {
    const a = answer();
    a.options = a.options.map((o) => ({ ...o, is_correct: false }));
    expect(reassembleQuestion(a, dictionary)).toBeNull();
  });
});

// ─── Flat (image-PDF) schema validation ────────────────
describe('isValidFlatQuestion', () => {
  const valid = () => ({
    topic: 'T',
    subtopic: 'S',
    question_text: 'Q?',
    options: ['A', 'B'],
    correct_answer: 'A',
    explanation: 'E',
  });

  it('accepts a complete question', () => {
    expect(isValidFlatQuestion(valid())).toBe(true);
  });

  it('tolerates whitespace when matching the correct answer', () => {
    expect(isValidFlatQuestion({ ...valid(), options: [' A ', 'B'], correct_answer: 'A' })).toBe(true);
  });

  it('rejects a correct_answer that is not among the options', () => {
    expect(isValidFlatQuestion({ ...valid(), correct_answer: 'C' })).toBe(false);
  });

  it.each(['topic', 'subtopic', 'question_text', 'explanation'])('rejects a missing %s', (field) => {
    const q = valid();
    delete q[field];
    expect(isValidFlatQuestion(q)).toBe(false);
  });

  it('rejects fewer than two options', () => {
    expect(isValidFlatQuestion({ ...valid(), options: ['A'], correct_answer: 'A' })).toBe(false);
  });
});

// ─── Dedup ─────────────────────────────────────────────
describe('dedupeByQuestionText', () => {
  it('keeps the first occurrence of a repeated question', () => {
    const result = dedupeByQuestionText([
      { question_text: 'Q1', topic: 'first' },
      { question_text: 'Q2', topic: 'other' },
      { question_text: 'Q1', topic: 'second' },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].topic).toBe('first');
  });

  it('passes through a list with no repeats', () => {
    const input = [{ question_text: 'A' }, { question_text: 'B' }];
    expect(dedupeByQuestionText(input)).toHaveLength(2);
  });

  it('handles an empty list', () => {
    expect(dedupeByQuestionText([])).toEqual([]);
  });
});
