import { AudioClassifier, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@0.10.0";

let audioClassifier;
let aiTopGuesses = [];

// -----------------------------------------
// 1. Initialize AI
// -----------------------------------------
async function initAI() {
    const audio = await FilesetResolver.forAudioTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@0.10.0/wasm");
    audioClassifier = await AudioClassifier.createFromOptions(audio, {
        baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite"
        }
    });
    document.getElementById('status').innerText = "AI Ready! Pass to Performer.";
    document.getElementById('performer-screen').classList.remove('hidden');
}

// -----------------------------------------
// 2. Handle Recording and AI Prediction
// -----------------------------------------
document.getElementById('record-btn').onclick = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    const audioChunks = [];

    const recordBtn = document.getElementById('record-btn');
    recordBtn.innerText = "🔴 Listening... (3s)";
    recordBtn.disabled = true;

    mediaRecorder.addEventListener("dataavailable", event => {
        audioChunks.push(event.data);
    });

    mediaRecorder.addEventListener("stop", async () => {
        document.getElementById('status').innerText = "AI is thinking...";

        const audioBlob = new Blob(audioChunks);
        const arrayBuffer = await audioBlob.arrayBuffer();

        // Decode audio at 16kHz for YAMNet
        const audioCtx = new AudioContext({ sampleRate: 16000 });
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);

        // Feed data to the AI
        const results = audioClassifier.classify(channelData);

        // Extract the TOP 5 Guesses
        aiTopGuesses = [];
        if (results.length > 0 && results[0].classifications.length > 0) {
            const categories = results[0].classifications[0].categories;
            
            // Loop through the top 5
            for (let i = 0; i < Math.min(5, categories.length); i++) {
                 // Only include if the AI is at least 5% confident
                 if (categories[i].score > 0.05) {
                     aiTopGuesses.push(categories[i].categoryName.toLowerCase());
                 }
            }
            console.log("AI Top 5 Guesses:", aiTopGuesses);
        } else {
            aiTopGuesses = ["unknown noise"];
        }

        // Shut down the microphone
        stream.getTracks().forEach(track => track.stop());

        // Update UI
        document.getElementById('performer-screen').classList.add('hidden');
        document.getElementById('guesser-screen').classList.remove('hidden');
        document.getElementById('status').innerText = "Pass the laptop!";
        
        recordBtn.innerText = "Record Sound (3s)";
        recordBtn.disabled = false;
    });

    mediaRecorder.start();
    setTimeout(() => { mediaRecorder.stop(); }, 3000);
};


// -----------------------------------------
// 3. Fuzzy Matching Logic (The "Forgiving" Judge)
// -----------------------------------------
// Calculates how many typos (edit distance) exist between two words
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
        // 1. Exact Match or Substring (e.g., "whistle" is in "whistling")
        if (aiWord.includes(userGuess) || userGuess.includes(aiWord)) {
            return true;
        }
        
        // 2. Typo Match (Allow 1 typo for short words, 2 typos for long words)
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
    
    document.getElementById('guesser-screen').classList.add('hidden');
    document.getElementById('result-screen').classList.remove('hidden');
    document.getElementById('status').innerText = "The Results!";
    
    // Show the user ALL the things the AI thought it was
    // .join(", ") turns the array ["dog", "animal"] into "dog, animal"
    document.getElementById('ai-guess').innerText = aiTopGuesses.join(", ");
    document.getElementById('user-guess').innerText = userGuess;

    // Use our custom fuzzy match function to decide the winner
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
    location.reload(); 
};

// Start the setup when the script loads
initAI();