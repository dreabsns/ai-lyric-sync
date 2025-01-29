let wavesurfer = null;
let model = null;

// Initialisierung
document.addEventListener('DOMContentLoaded', async () => {
    // Wavesurfer initialisieren
    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: '#6c5ce7',
        progressColor: '#4b4bff',
        cursorColor: '#2d3436',
        height: 120,
        responsive: true
    });

    // AI-Modell laden
    try {
        model = await ort.InferenceSession.create(
            'https://cdn.jsdelivr.net/gh/foobar/pretrained-models/melody_detection.onnx',
            { executionProviders: ['webgl'] }
        );
        updateStatus('Modell geladen', 100);
    } catch (error) {
        showError('AI-Modell konnte nicht geladen werden: ' + error.message);
    }
});

// Drag & Drop Handling
document.getElementById('dropZone').addEventListener('dragover', (e) => {
    e.preventDefault();
    e.currentTarget.style.background = 'rgba(108,92,231,0.1)';
});

document.getElementById('dropZone').addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.currentTarget.style.background = '';
});

document.getElementById('dropZone').addEventListener('drop', async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleAudioFile(file);
});

// Datei Handling
document.getElementById('audioInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleAudioFile(file);
});

async function handleAudioFile(file) {
    try {
        updateStatus('Audio wird verarbeitet...', 20);
        const url = URL.createObjectURL(file);
        await wavesurfer.load(url);
        updateStatus('Audio geladen', 40);
    } catch (error) {
        showError('Audiofehler: ' + error.message);
    }
}

async function startProcessing() {
    try {
        if (!model) throw new Error('AI-Modell nicht geladen');
        
        const lyrics = document.getElementById('lyricsInput').value;
        if (!lyrics) throw new Error('Keine Lyrics eingegeben');
        
        updateStatus('Starte Analyse...', 50);
        
        // Audiopuffer analysieren
        const peaks = wavesurfer.backend.getPeaks(44100);
        const inputTensor = new ort.Tensor('float32', peaks, [1, peaks.length]);
        
        // AI-Analyse
        const { output } = await model.run({ input: inputTensor });
        const vocalSegments = processOutput(output.data);
        
        // LRC generieren
        const lrcContent = generateLRC(lyrics.split('\n'), vocalSegments);
        
        // Ergebnis anzeigen
        document.getElementById('resultBox').hidden = false;
        const blob = new Blob([lrcContent], { type: 'text/plain' });
        document.getElementById('downloadBtn').href = URL.createObjectURL(blob);
        document.getElementById('downloadBtn').download = `synced_lyrics_${Date.now()}.lrc`;
        
        updateStatus('Erfolgreich synchronisiert!', 100);

    } catch (error) {
        showError(error.message);
    }
}

function processOutput(data) {
    const segments = [];
    let currentSegment = null;
    const threshold = 0.75;

    data.forEach((value, index) => {
        const time = index / 100; // 100Hz Auflösung
        
        if (value > threshold) {
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

function generateLRC(lyrics, segments) {
    let lrc = '[re:AI Synchronized Lyrics]\n';
    let lineIndex = 0;
    
    segments.forEach(segment => {
        const duration = segment.end - segment.start;
        const linesPerSegment = Math.ceil(lyrics.length * (duration / getTotalDuration(segments)));
        
        for (let i = 0; i < linesPerSegment; i++) {
            if (lineIndex >= lyrics.length) break;
            const time = segment.start + (i * (duration / linesPerSegment));
            lrc += `[${formatTime(time)}] ${lyrics[lineIndex]}\n`;
            lineIndex++;
        }
    });
    
    return lrc;
}

// Hilfsfunktionen
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toFixed(2).padStart(5, '0');
    return `${mins}:${secs}`;
}

function getTotalDuration(segments) {
    return segments.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
}

function updateStatus(text, progress) {
    document.getElementById('statusText').textContent = text;
    document.querySelector('.progress::after').style.width = `${progress}%`;
}

function showError(message) {
    alert(`❌ Fehler: ${message}`);
    updateStatus('Fehler aufgetreten', 0);
}
