# Sound Guesser AI 🐎🔊

**Sound Guesser AI** is a sound-charades party game based on Google AI Studio and Gemini in which **an AI listens to your sound**. One player imitates a sound into the microphone, such as a dog barking, a car engine or a ghost. A multimodal AI model listens to the raw audio and privately decides what the sound is. A second player then guesses. You win the round when **your guess matches what the AI heard**.

You are not trying to stump your friend. You are trying to be understood by a machine, and finding out what the AI *thought* your sound was is most of the fun.

---

## 🧠 Powered by Google AI

The AI judge in this game is built entirely on Google's AI stack:

| Google AI tool | What it does in Sound Guesser |
| --- | --- |
| **[Gemini 2.5 Flash](https://ai.google.dev/gemini-api/docs/models#gemini-2.5-flash)** | The model that **listens to your sound**. It's natively multimodal, so it takes raw audio as input and understands non-speech sounds such as barks, engine revs, whooshes and howls. There's no speech-to-text step in between. It returns its top 5 guesses for what you were imitating. |
| **[Gemini API](https://ai.google.dev/gemini-api/docs)** (`generativelanguage.googleapis.com`, `v1beta/models/gemini-2.5-flash:generateContent`) | The REST endpoint the game calls. The recorded clip is sent as base64 **inline audio data** (`inline_data`) alongside a text prompt in a single multimodal request. See [Audio understanding](https://ai.google.dev/gemini-api/docs/audio). |
| **[Google AI Studio](https://aistudio.google.com/)** | Where the `GEMINI_API_KEY` is created, and a handy place to try out the judge prompt against sample audio before changing it in code. |

**Why Gemini?** Most sounds in sound charades aren't words, so a transcription service would hear nothing useful. Gemini 2.5 Flash reasons directly over the audio, is fast enough for a party game (results arrive a few seconds after recording), and follows tight output instructions ("a comma-separated, lowercase list"), so the response can be parsed without extra work.

All Gemini calls happen server-side in [`netlify/functions/judge.js`](netlify/functions/judge.js). The API key is never exposed to the browser.

---

## How the AI hears your sound

Most of what makes the game work happens in this pipeline:

```
 ┌──────────────┐   5 s of audio    ┌────────────────────┐   audio + prompt   ┌──────────────────────┐
 │   Browser    │ ───────────────▶  │  Netlify Function  │ ─────────────────▶ │  Google Gemini 2.5   │
 │ MediaRecorder│  base64 + MIME    │  /judge            │   inline_data      │  Flash (multimodal)  │
 └──────────────┘                   └────────────────────┘                    └──────────────────────┘
        ▲                                     │                                          │
        │       { guesses: [5 labels] }       │   "dog, wolf, siren, wind, baby crying"  │
        └─────────────────────────────────────┴──────────────────────────────────────────┘
```

### 1. Capturing the sound (`script.js`)

- When the performer presses **Record**, the browser asks for microphone permission *before* the countdown starts, so a permission popup can't eat into the recording window.
- A **3-second "Get ready…" countdown** follows, then exactly **5 seconds** of audio are recorded with the browser's native `MediaRecorder` API.
- The recording is kept in whatever format the browser produces (usually `audio/webm` on Chrome or Android and `audio/mp4` on Safari or iOS). It is **not transcoded**. The real `mediaRecorder.mimeType` is sent along with the audio, so the AI is told exactly which format it is receiving.
- The audio blob is base64-encoded and POSTed to the serverless function.

### 2. The AI judge (`netlify/functions/judge.js`)

The judge is a Netlify serverless function that forwards the audio to **Google's Gemini 2.5 Flash** via the `generateContent` REST endpoint. Gemini is natively multimodal: it **listens to the audio directly**, with no speech-to-text step and no separate audio classifier. That matters for this game because most charade sounds aren't words. Howls, whooshes, engine revs and squeaks would come out of a transcription step as noise or nothing at all.

The audio is sent as an `inline_data` part together with this prompt:

> *You are a judge in a game of sound charades. Listen to this audio clip of a human imitating a sound. What are the top 5 things they are trying to imitate? Keep the guesses simple. Reply ONLY with a comma-separated list, all lowercase. Example: dog, car engine, wind, ghost, crying.*

Prompt design choices:

| Choice | Why |
| --- | --- |
| **"A human imitating a sound"** | Tells the model the input is a *person's impression* of a dog, not a real dog. That puts it in charades mode instead of field-recording mode, so it is more charitable to mouth noises. |
| **Top 5 guesses, not 1** | Human sound effects are ambiguous. A rising "wooOOOooo" could be a ghost, the wind or an owl. Five candidates give the guesser a fair target while still rewarding a clear performance. |
| **"Keep the guesses simple"** | Keeps answers to everyday nouns ("cat", not "domestic feline vocalization") so a human has a realistic chance of matching. |
| **Comma-separated, lowercase only** | Gives machine-parseable output with no JSON or markdown to strip. The function splits on commas and trims each item. |
| **Concrete example list** | Few-shot anchoring on both format and level of detail. |

The model's MIME type is taken from the browser and stripped of codec parameters (`audio/webm;codecs=opus` becomes `audio/webm`) before it is sent, because Gemini expects a bare media type.

The function returns `{ "guesses": ["dog", "wolf", ...] }` on success or `{ "error": "..." }` on failure. It always uses HTTP 200 so the front end can show the actual error message in the game instead of failing silently.

### 3. Matching the human to the AI (`script.js`)

The AI's five guesses stay **hidden** until the guesser submits. The guess then counts as a match if, for **any** of the five AI labels:

- **Substring match:** either string contains the other ("car" matches "car engine", and "barking dog" matches "dog"), **or**
- **Typo tolerance:** the [Levenshtein edit distance](https://en.wikipedia.org/wiki/Levenshtein_distance) is within budget: **1 edit** for labels of 5 characters or fewer and **2 edits** for longer ones ("elefant" matches "elephant").

The result screen then shows the full list of what the AI heard next to your guess. That reveal is often the funniest part of the round.

---

## How to play

1. **Performer:** press **Record Sound**, wait for the countdown, then make your sound for 5 seconds.
2. Wait a few seconds while the AI listens and thinks.
3. **Pass the device** to the guesser.
4. **Guesser:** type what you think the sound was and press **Submit Guess**.
5. See whether you matched any of the AI's top 5 interpretations, then press **Next Round**.

---

## Project structure

```
sound-guesser/
├── index.html                  # Game screens: performer, guesser, result
├── style.css                   # Styling
├── script.js                   # Recording, API call, fuzzy matching, game flow
├── horse.png                   # Echo Derby mascot
└── netlify/
    └── functions/
        └── judge.js            # Serverless AI judge (Gemini 2.5 Flash)
```

There is no build step, framework or `package.json`. The front end is plain HTML, CSS and ES-module JavaScript, and the function uses Node's built-in `fetch`.

---

## Running it

The app depends on the serverless function, so it needs to run on **Netlify**, either deployed or through the Netlify CLI. Opening `index.html` directly won't work.

### Prerequisites

- A **Google Gemini API key** from [Google AI Studio](https://aistudio.google.com/app/apikey)
- For local development, the [Netlify CLI](https://docs.netlify.com/cli/get-started/): `npm install -g netlify-cli`

### Local development

```bash
# Supply the key (or set it in the Netlify UI and use `netlify link`)
export GEMINI_API_KEY=your-key-here      # PowerShell: $env:GEMINI_API_KEY="your-key-here"

netlify dev
```

`netlify dev` serves the static site and the function at `/.netlify/functions/judge`. Open the URL it prints. Browsers allow microphone access on `localhost`.

### Deploying

1. Connect the repo to a Netlify site (publish directory: the repo root; functions directory: `netlify/functions`, which is Netlify's default).
2. Under **Site configuration → Environment variables**, add `GEMINI_API_KEY`.
3. Deploy. Microphone access requires **HTTPS**, which Netlify provides automatically.

The API key only ever lives in the serverless function's environment and is **never sent to the browser**.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `⚠️ Mic Error: ...` / "Microphone Blocked" | The browser was denied mic access. Allow it in the site permissions. On mobile, the OS-level mic permission for the browser app must also be enabled. |
| **⚠️ GAME BROKE!** with `Missing GEMINI_API_KEY in Netlify` | The environment variable isn't set for the function. Set it and redeploy (or restart `netlify dev`). |
| **⚠️ GAME BROKE!** with `Google Error: ...` | Gemini rejected the request, for example because of an invalid key, an exhausted quota or audio it couldn't decode. The message comes straight from Google's API. |
| `error: server connection failed` | The front end couldn't reach `/.netlify/functions/judge`. You are probably serving the files without Netlify. |

---

## Known limitations and ideas

- **One model call per round.** Each recording costs one Gemini request. The 5-second cap keeps the payload small (well under Gemini's inline-data limit) and the response quick.
- **An empty guess always matches.** An empty string is a substring of every label, so submitting nothing counts as a match. Ignoring blank guesses would fix this.
- **Matching is lexical, not semantic.** "puppy" won't match "dog", and "automobile" won't match "car". A natural next step is to send the guess back to the AI and ask whether it means the same thing as any of its labels.
- **Next Round reloads the page.** This keeps state simple but means there is no score tracking yet. Scoring across rounds, or showing which of the five labels matched, would be easy additions.
- **Possible AI extensions:** have the AI rate *how convincing* the performance was, generate a sound prompt for the performer, or let the AI play the guesser against human performers.
