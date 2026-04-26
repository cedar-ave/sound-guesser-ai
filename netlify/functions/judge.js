export const handler = async (event) => {
    try {
        const body = JSON.parse(event.body);
        const base64Audio = body.audioBase64;
        
        // Grab the exact mimeType sent from the browser (and clean off any codec info)
        const mimeType = (body.mimeType || "audio/webm").split(';')[0];

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