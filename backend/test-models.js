require('dotenv').config({ path: '.env' });
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function getAvailableModels(ai) {
  try {
    const response = await ai.models.list();
    const models = [];
    for await (const m of response) {
      if (!m.name) continue;
      const name = m.name.replace('models/', '');
      
      if (
        name.includes('embedding') || 
        name.includes('imagen') || 
        name.includes('veo') || 
        name.includes('tts') ||
        name.includes('audio') ||
        name.includes('aqa') ||
        name.includes('research') ||
        name.includes('antigravity') ||
        name.includes('robotics') ||
        name.includes('computer-use')
      ) {
        continue;
      }
      
      if (name.includes('gemini') || name.includes('gemma')) {
        models.push(name);
      }
    }
    
    console.log("All raw filtered models:", models);
    
    const getScore = (name) => {
      let score = 0;
      if (name.includes('3.1') || name.includes('3.0') || name.includes('3-pro')) return -100;
      if (name.includes('2.5-flash')) score += 100;
      else if (name.includes('2.0-flash')) score += 80;
      else if (name.includes('1.5-flash')) score += 50;
      else if (name.includes('pro')) score += 20;
      
      if (!name.includes('preview') && !name.includes('exp')) score += 10;
      if (name.includes('lite') || name.includes('8b')) score -= 10;
      return score;
    };
    
    const scoredModels = models.map(m => ({ name: m, score: getScore(m) }));
    scoredModels.sort((a, b) => b.score - a.score);
    
    console.log("\nScored Models:", scoredModels);
    
    const filteredModels = scoredModels.filter(m => m.score > -50).map(m => m.name);
    console.log("\nFinal array before slicing:", filteredModels);
    
    if (filteredModels.length > 0) {
      return filteredModels.slice(0, 3);
    }
  } catch (err) {
    console.error("Failed to list models", err);
  }
}

getAvailableModels(ai).then(models => console.log("\nTop 3 picked models:", models));
