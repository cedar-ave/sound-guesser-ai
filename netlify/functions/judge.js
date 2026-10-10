// 5 seconds of compressed audio is well under 200 KB; this leaves plenty of headroom
const MAX_AUDIO_BASE64_LENGTH = 1_500_000;

// Netlify sets these automatically: production URL, this deploy's URL, and branch/preview URL
const ALLOWED_ORIGINS = [process.env.URL, process.env.DEPLOY_URL, process.env.DEPLOY_PRIME_URL].filter(Boolean);

function isAllowedOrigin(origin) {
    if (!origin) return false;
    // Allow local development via `netlify dev`
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
    return ALLOWED_ORIGINS.includes(origin);
}

const reject = (statusCode, message) => ({ statusCode, body: JSON.stringify({ error: message }) });

export const handler = async (event) => {
    try {
        // Only accept POSTs made by our own game page
        if (event.httpMethod !== 'POST') {
            return reject(405, "Method not allowed");
        }
        if (!isAllowedOrigin(event.headers.origin)) {
            return reject(403, "Forbidden origin");
        }
        if (!event.body || event.body.length > MAX_AUDIO_BASE64_LENGTH + 1000) {
            return reject(413, "Request too large");
        }

        const body = JSON.parse(event.body);
        const base64Audio = body.audioBase64;

        // Grab the exact mimeType sent from the browser (and clean off any codec info)
        const mimeType = (body.mimeType || "audio/webm").split(';')[0];

        // Only forward real audio clips to Gemini
        if (typeof base64Audio !== 'string' || base64Audio.length === 0) {
            return reject(400, "Missing audio");
        }
        if (base64Audio.length > MAX_AUDIO_BASE64_LENGTH) {
            return reject(413, "Audio clip too large");
        }
        if (!mimeType.startsWith('audio/')) {
            return reject(400, "Invalid audio type");
        }

        const apiKey = process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
             return { statusCode: 200, body: JSON.stringify({ error: "Missing GEMINI_API_KEY in Netlify" }) };
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const prompt = "You are a judge in a game of sound charades. Listen to this audio clip of a human imitating a sound. What are the top 5 things they are trying to imitate? Keep the guesses simple. Reply ONLY with a comma-separated list, all lowercase. Example: dog, car engine, wind, ghost, crying.";

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: mimeType, data: base64Audio } }
                    ]
                }]
            })
        });

        const data = await response.json();
        
        // Catch any errors Google returns (like bad audio or invalid keys)
        if (data.error) {
            console.error("Google API Error:", data.error);
            return { statusCode: 200, body: JSON.stringify({ error: `Google Error: ${data.error.message}` }) };
        }

        const aiResponseText = data.candidates[0].content.parts[0].text;
        const topGuesses = aiResponseText.split(',').map(item => item.trim());

        return {
            statusCode: 200,
            body: JSON.stringify({ guesses: topGuesses })
        };
    } catch (error) {
        console.error("Function Crash:", error);
        return { statusCode: 200, body: JSON.stringify({ error: `Function crashed: ${error.message}` }) };
    }
};