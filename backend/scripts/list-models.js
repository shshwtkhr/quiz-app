// Prints the models your API key can see, scored and ranked exactly as the
// parsing pipeline would rank them, so you can tell in advance which model a
// job will try first and what its fallback chain looks like.
//
// The scoring is imported from the real implementation rather than copied —
// a duplicated copy silently drifts and then lies to you.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { GoogleGenAI } = require('@google/genai');
const {
  getScore,
  isSupportedModel,
  rankModels,
} = require('../src/services/documentParsing');

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set in backend/.env');
    console.error('(The app can also read the key from the MongoDB Config');
    console.error(' collection, but this script only reads the environment.)');
    process.exit(1);
  }

  // Constructed after the check — the SDK warns on a missing key at construction.
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await ai.models.list();
  const all = [];
  for await (const m of response) {
    if (m.name) all.push(m.name.replace('models/', ''));
  }

  const supported = all.filter(isSupportedModel);
  const ranked = rankModels(all);

  console.log(`\n${all.length} models visible to this key.`);
  console.log(`${supported.length} are gemini/gemma text models.\n`);

  console.log('Ranked (this is the fallback order — index 0 is tried first):');
  for (const [i, name] of ranked.entries()) {
    console.log(`  ${String(i).padStart(2)}. ${name.padEnd(45)} score ${getScore(name)}`);
  }

  const rejected = supported.filter((m) => !ranked.includes(m));
  if (rejected.length) {
    console.log('\nRejected (score at or below the -50 cutoff):');
    for (const name of rejected) {
      console.log(`      ${name.padEnd(45)} score ${getScore(name)}`);
    }
  }
  console.log();
}

main().catch((err) => {
  console.error('Failed to list models:', err.message || err);
  process.exit(1);
});
