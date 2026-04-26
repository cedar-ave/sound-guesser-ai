export const handler = async (event) => {
    // 1. Get the audio data sent from the browser
    const body = JSON.parse(event.body);
    const base64Audio = body.audioBase64;

    // 2. Build the request to Gemini 1.5 Flash
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const prompt = "You are a judge in a game of sound charades. Listen to this audio clip of a human imitating a sound. What are the top 5 things they are trying to imitate? Keep the guesses simple. Reply ONLY with a comma-separated list, all lowercase. Example: dog, car engine, wind, ghost, crying.";

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: "audio/webm", data: base64Audio } }
                    ]
                }]
            })
        });

        const data = await response.json();
        
        // Extract the text from Gemini's response
        const aiResponseText = data.candidates[0].content.parts[0].text;
        
        // Turn the comma-separated text into a clean array
        const topGuesses = aiResponseText.split(',').map(item => item.trim());

        return {
            statusCode: 200,
            body: JSON.stringify({ guesses: topGuesses })
        };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: "AI failed to judge" }) };
    }
};