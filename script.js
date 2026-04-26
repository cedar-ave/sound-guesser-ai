// Global variable to store the AI's answers
let aiTopGuesses = [];

// -----------------------------------------
// 1. Initialize UI (No downloads needed anymore!)
// -----------------------------------------
// The AI is on the server now, so the game is instantly ready.
document.getElementById('status').innerText = "AI Ready! Pass to Performer.";
document.getElementById('performer-screen').classList.remove('hidden');

// -----------------------------------------
// 2. Handle Recording and AI Request
// -----------------------------------------
document.getElementById('record-btn').onclick = async () => {
    // Request microphone access
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    const audioChunks = [];

    // Update UI
    const recordBtn = document.getElementById('record-btn');
    recordBtn.innerText = "🔴 Listening... (3s)";
    recordBtn.disabled = true;

    // Collect audio data
    mediaRecorder.addEventListener("dataavailable", event => {
        audioChunks.push(event.data);
    });

    // Process audio when recording stops
    mediaRecorder.addEventListener("stop", async () => {
        document.getElementById('status').innerText = "Smart AI is thinking...";

        // Combine chunks into a single webm audio file
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        
        // Convert the audio file into a Base64 string so we can send it as text
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
            // Remove the "data:audio/webm;base64," prefix to get raw data
            const base64Audio = reader.result.split(',')[1]; 

            try {
                // Send it to your hidden Netlify Function
                const response = await fetch('/.netlify/functions/judge', {
                    method: 'POST',
                    body: JSON.stringify({ audioBase64: base64Audio })
                });

                const data = await response.json();
                
                if (data.guesses) {
                    aiTopGuesses = data.guesses;
                    console.log("Smart AI Guesses:", aiTopGuesses);
                } else {
                    aiTopGuesses = ["error: couldn't understand audio"];
                }
            } catch (error) {
                console.error("Failed to reach Netlify Function:", error);
                aiTopGuesses = ["error: server connection failed"];
            }

            // Shut down the microphone
            stream.getTracks().forEach(track => track.stop());

            // Update UI for the Guesser
            document.getElementById('performer-screen').classList.add('hidden');
            document.getElementById('guesser-screen').classList.remove('hidden');
            document.getElementById('status').innerText = "Pass the laptop!";
            
            // Reset button state
            recordBtn.innerText = "Record Sound (3s)";
            recordBtn.disabled = false;
        };
    });

    // Start recording
    mediaRecorder.start();

    // Automatically stop after 3 seconds
    setTimeout(() => {
        mediaRecorder.stop();
    }, 3000);
};

// -----------------------------------------
// 3. Fuzzy Matching Logic (Typo Forgiveness)
// -----------------------------------------
// Calculates how many typos exist between two words
function getTypoCount(str1, str2) {
    if (str1.length === 0) return str2.length;
    if (str2.length === 0) return str1.length;
    let matrix = [];
    for (let i = 0; i <= str2.length; i++) { matrix[i] = [i]; }
    for (let j = 0; j <= str1.length; j++) { matrix[0][j] = j; }
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) == str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
            }
        }
    }
    return matrix[str2.length][str1.length];
}

// Checks if the user's guess is "close enough" to any of the AI's guesses
function isCloseEnough(userGuess, aiArray) {
    for (let aiWord of aiArray) {
        // Exact Match or Substring (e.g., "whistle" is in "whistling")
        if (aiWord.includes(userGuess) || userGuess.includes(aiWord)) {
            return true;
        }
        
        // Typo Match (Allow 1 typo for short words, 2 typos for long words)
        let allowedTypos = aiWord.length > 5 ? 2 : 1;
        if (getTypoCount(userGuess, aiWord) <= allowedTypos) {
            return true;
        }
    }
    return false;
}

// -----------------------------------------
// 4. Handle the Guess and Reveal
// -----------------------------------------
document.getElementById('submit-guess').onclick = () => {
    // Get user guess and clean it up (remove spaces, make lowercase)
    const userGuess = document.getElementById('guess-input').value.trim().toLowerCase();
    
    // Switch to Result Screen
    document.getElementById('guesser-screen').classList.add('hidden');
    document.getElementById('result-screen').classList.remove('hidden');
    document.getElementById('status').innerText = "The Results!";
    
    // Populate the text
    document.getElementById('ai-guess').innerText = aiTopGuesses.join(", ");
    document.getElementById('user-guess').innerText = userGuess;

    // Decide the winner using the fuzzy match
    if (isCloseEnough(userGuess, aiTopGuesses)) {
        document.getElementById('match-status').innerText = "✅ YOU MATCHED THE AI!";
        document.getElementById('match-status').style.color = "#4ade80"; // Green text
    } else {
        document.getElementById('match-status').innerText = "❌ NO MATCH";
        document.getElementById('match-status').style.color = "#f87171"; // Red text
    }
};

// -----------------------------------------
// 5. Reset Game Loop
// -----------------------------------------
window.resetGame = () => {
    // Reloads the page to clear memory and start fresh
    location.reload(); 
};