let aiTopGuesses = [];

// -----------------------------------------
// 1. Initialize UI 
// -----------------------------------------
document.getElementById('status').innerText = "AI Ready! Pass to Performer.";
document.getElementById('performer-screen').classList.remove('hidden');

// -----------------------------------------
// 2. Handle Recording and AI Request
// -----------------------------------------
document.getElementById('record-btn').onclick = async () => {
    const recordBtn = document.getElementById('record-btn');
    recordBtn.disabled = true;

    // Request microphone access FIRST so permission popups don't ruin the timer
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    const audioChunks = [];

    // Countdown Logic
    let countdown = 3;
    recordBtn.innerText = `Get ready... ${countdown}`;

    const timer = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            recordBtn.innerText = `Get ready... ${countdown}`;
        } else {
            // Stop the countdown timer
            clearInterval(timer);
            
            // Start the actual recording
            recordBtn.innerText = "🔴 Listening... (5s)";
            startRecording(stream, mediaRecorder, audioChunks, recordBtn);
        }
    }, 1000); 
};

// Helper function to handle the actual recording
function startRecording(stream, mediaRecorder, audioChunks, recordBtn) {
    mediaRecorder.addEventListener("dataavailable", event => {
        audioChunks.push(event.data);
    });

    mediaRecorder.addEventListener("stop", async () => {
        // --- THE FIX: Immediately update UI so they know the mic is off ---
        document.getElementById('status').innerText = "Smart AI is thinking...";
        recordBtn.innerText = "⏳ Processing..."; 

        const actualMimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunks, { type: actualMimeType });
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
            const base64Audio = reader.result.split(',')[1]; 

            try {
                const response = await fetch('/.netlify/functions/judge', {
                    method: 'POST',
                    body: JSON.stringify({ 
                        audioBase64: base64Audio,
                        mimeType: actualMimeType 
                    })
                });

                const data = await response.json();
                
                if (data.guesses) {
                    aiTopGuesses = data.guesses;
                    console.log("Smart AI Guesses:", aiTopGuesses);
                } else if (data.error) {
                    aiTopGuesses = [data.error];
                    console.error("Backend Error:", data.error);
                } else {
                    aiTopGuesses = ["error: unknown failure"];
                }
            } catch (error) {
                console.error("Failed to reach Netlify:", error);
                aiTopGuesses = ["error: server connection failed"];
            }

            stream.getTracks().forEach(track => track.stop());

            document.getElementById('performer-screen').classList.add('hidden');
            document.getElementById('guesser-screen').classList.remove('hidden');
            document.getElementById('status').innerText = "Pass the laptop!";
            
            // Reset the button for the next turn
            recordBtn.innerText = "Record Sound (5s)";
            recordBtn.disabled = false;
        };
    });

    mediaRecorder.start();
    
    // Stop recording after 5 seconds
    setTimeout(() => { mediaRecorder.stop(); }, 5000);
}

// -----------------------------------------
// 3. Fuzzy Matching Logic
// -----------------------------------------
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

function isCloseEnough(userGuess, aiArray) {
    for (let aiWord of aiArray) {
        if (aiWord.includes(userGuess) || userGuess.includes(aiWord)) {
            return true;
        }
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
    const userGuess = document.getElementById('guess-input').value.trim().toLowerCase();
    
    document.getElementById('guesser-screen').classList.add('hidden');
    document.getElementById('result-screen').classList.remove('hidden');
    document.getElementById('status').innerText = "The Results!";
    
    document.getElementById('ai-guess').innerText = aiTopGuesses.join(", ");
    document.getElementById('user-guess').innerText = userGuess;

    if (aiTopGuesses[0].startsWith("Google Error") || aiTopGuesses[0].startsWith("error")) {
         document.getElementById('match-status').innerText = "⚠️ GAME BROKE!";
         document.getElementById('match-status').style.color = "#facc15"; 
    }
    else if (isCloseEnough(userGuess, aiTopGuesses)) {
        document.getElementById('match-status').innerText = "✅ YOU MATCHED THE AI!";
        document.getElementById('match-status').style.color = "#4ade80"; 
    } else {
        document.getElementById('match-status').innerText = "❌ NO MATCH";
        document.getElementById('match-status').style.color = "#f87171"; 
    }
};

// -----------------------------------------
// 5. Reset Game Loop
// -----------------------------------------
window.resetGame = () => {
    location.reload(); 
};