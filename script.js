import { AudioClassifier, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@0.10.0";

let audioClassifier;
let aiSecretGuess = "";

// 1. Initialize AI
async function initAI() {
    const audio = await FilesetResolver.forAudioTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@0.10.0/wasm");
    audioClassifier = await AudioClassifier.createFromOptions(audio, {
        baseOptions: {
            // Loading the pre-trained YAMNet model directly from Google
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite"
        }
    });
    document.getElementById('status').innerText = "AI Ready! Pass to Performer.";
    document.getElementById('performer-screen').classList.remove('hidden');
}

// 2. Handle Recording and AI Prediction
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
        document.getElementById('status').innerText = "AI is thinking...";

        // Combine chunks into a single Blob
        const audioBlob = new Blob(audioChunks);
        const arrayBuffer = await audioBlob.arrayBuffer();

        // Decode audio at 16kHz (Required by YAMNet)
        const audioCtx = new AudioContext({ sampleRate: 16000 });
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        // Extract raw sound wave data from the first channel
        const channelData = audioBuffer.getChannelData(0);

        // Feed data to the AI
        const results = audioClassifier.classify(channelData);

        // Extract the best guess
        if (results.length > 0 && results[0].classifications.length > 0) {
            const categories = results[0].classifications[0].categories;
            aiSecretGuess = categories[0].categoryName;
            console.log("Full AI Results:", categories); // View in DevTools (F12)
        } else {
            aiSecretGuess = "Unknown Noise";
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
    });

    // Start recording
    mediaRecorder.start();

    // Automatically stop after 3 seconds
    setTimeout(() => {
        mediaRecorder.stop();
    }, 3000);
};

// 3. Handle the Guess and Reveal
document.getElementById('submit-guess').onclick = () => {
    const userGuess = document.getElementById('guess-input').value;
    
    // Switch to Result Screen
    document.getElementById('guesser-screen').classList.add('hidden');
    document.getElementById('result-screen').classList.remove('hidden');
    document.getElementById('status').innerText = "The Results!";
    
    // Populate the text
    document.getElementById('ai-guess').innerText = aiSecretGuess;
    document.getElementById('user-guess').innerText = userGuess;

    // Simple comparison logic
    if (userGuess.trim().toLowerCase() === aiSecretGuess.toLowerCase()) {
        document.getElementById('match-status').innerText = "✅ YOU MATCHED THE AI!";
    } else {
        document.getElementById('match-status').innerText = "❌ NO MATCH";
    }
};

// 4. Reset Game Loop
window.resetGame = () => {
    // Easiest way to reset the app state locally
    location.reload(); 
};

// Start the setup when the script loads
initAI();