// Standalone connectivity check: lists the models the key can see, then makes
// one generateContent call. Use it to tell an API-key problem apart from a
// parsing-pipeline problem.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function test() {
    try {
        console.log("Listing models...");
        const response = await ai.models.list();
        const models = [];
        for await (const m of response) {
            if (m.name.includes('gemini') || m.name.includes('gemma')) {
                models.push(m.name.replace('models/', ''));
            }
        }
        console.log("Found models:", models);
        
        console.log("Testing generateContent on gemini-2.5-flash...");
        const res = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'Hello world',
        });
        console.log("Response:", res.text);
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
