const AI_MODEL_URL = 'https://raw.githubusercontent.com/MTG/melodia/main/melodia.onnx';
let audioContext;
let model;

async function loadModel() {
    model = await ort.InferenceSession.create(AI_MODEL_URL);
}

async function detectVocals(audioBuffer) {
    // Audio auf 22050Hz downsamplen
    const offlineContext = new OfflineAudioContext(
        1,
        audioBuffer.duration * 22050,
        22050
    );
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();
    
    const resampledBuffer = await offlineContext.startRendering();
    const audioData = resampledBuffer.getChannelData(0);
    
    // Vorverarbeitung für das Modell
    const inputTensor = new ort.Tensor('float32', audioData, [1, audioData.length]);
    
    // Modellausführung
    const outputs = await model.run({ input: inputTensor });
    const vocals = outputs.vocals.data;
    
    // Zeitstempel der Gesangssegmente
    return processVocalPredictions(vocals, 22050);
}

function processVocalPredictions(predictions, sampleRate) {
    const segments = [];
    let currentSegment = null;
    const threshold = 0.7; // Konfidenzschwelle
    
    predictions.forEach((confidence, index) => {
        const time = index / sampleRate;
        
        if (confidence > threshold) {
            if (!currentSegment) {
                currentSegment = { start: time, end: time };
            } else {
                currentSegment.end = time;
            }
        } else if (currentSegment) {
            segments.push(currentSegment);
            currentSegment = null;
        }
    });
    
    return segments;
}

async function startProcessing() {
    const audioFile = document.getElementById('audioUpload').files[0];
    const lyrics = document.getElementById('lyricsInput').value.split('\n').filter(l => l.trim());
    
    if (!audioFile || lyrics.length === 0) return;
    
    document.querySelector('button').disabled = true;
    document.getElementById('result').hidden = true;
    
    try {
        // 1. Audio analysieren
        const arrayBuffer = await audioFile.arrayBuffer();
        audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // 2. AI-Modell laden
        if (!model) await loadModel();
        
        // 3. Gesangssegmente erkennen
        const vocalSegments = await detectVocals(audioBuffer);
        
        // 4. Lyrics zuordnen
        const lrcContent = alignLyrics(lyrics, vocalSegments);
        
        // 5. Ergebnis anzeigen
        const blob = new Blob([lrcContent], { type: 'text/plain' });
        document.getElementById('downloadBtn').href = URL.createObjectURL(blob);
        document.getElementById('downloadBtn').download = `${audioFile.name.replace(/\.[^/.]+$/, "")}_synced.lrc`;
        document.getElementById('result').hidden = false;
        
    } catch (error) {
        alert(`Fehler: ${error.message}`);
    } finally {
        document.querySelector('button').disabled = false;
    }
}

function alignLyrics(lyrics, segments) {
    let lrc = '[re:AI Synchronized]\n';
    let lyricIndex = 0;
    
    segments.forEach(segment => {
        const duration = segment.end - segment.start;
        const linesInSegment = Math.ceil(lyrics.length * (duration / getTotalDuration(segments)));
        
        for (let i = 0; i < linesInSegment; i++) {
            if (lyricIndex >= lyrics.length) break;
            const lineTime = segment.start + (i * (duration / linesInSegment));
            lrc += `[${formatTime(lineTime)}] ${lyrics[lyricIndex]}\n`;
            lyricIndex++;
        }
    });
    
    return lrc;
}

function getTotalDuration(segments) {
    return segments.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toFixed(2).padStart(5, '0');
    return `${mins}:${secs}`;
}
