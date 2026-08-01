/**
 * Shared manual mock for @google/genai.
 *
 * Used via `jest.mock('@google/genai', () => require('./helpers/genai-mock'))`.
 * The jest.fn()s are created inside this module so the mock factory has nothing
 * to close over, then re-exported on `__mocks` for tests to program.
 *
 *   const { __mocks } = require('@google/genai');
 *   __mocks.generateContent.mockResolvedValue({ text: '...' });
 */
const generateContent = jest.fn();
const list = jest.fn();

const GoogleGenAI = jest.fn(() => ({
  models: { generateContent, list },
}));

/** Build the async iterable that ai.models.list() is expected to return. */
function modelList(names) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const name of names) yield { name: `models/${name}` };
    },
  };
}

module.exports = {
  GoogleGenAI,
  __mocks: { generateContent, list, GoogleGenAI, modelList },
};
