// script.js
let wavesurfer = null;
let model = null;
let audioBuffer = null;

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

    // KI-Modell laden
    model = await tf.loadLayersModel('https://your-model-host.com/model.json');
});

async function startProcessing() {
    try {
        // Validierung
        if (!state.currentFile) throw new Error('Keine Audio-Datei hochgeladen');
        if (!document.getElementById('lyricsInput').value) throw new Error('Keine Lyrics eingegeben');

        updateProgress(10, 'Analysiere Audio...');
        
        // Audio analysieren
        const lyrics = document.getElementById('lyricsInput').value.split('\n').filter(l => l.trim());
        const peaks = wavesurfer.backend.getPeaks(44100);
        
        updateProgress(30, 'Erkenne Gesang...');
        const vocalSegments = await detectVocals(peaks);
        
        updateProgress(60, 'Synchronisiere Lyrics...');
        const lrcContent = generateLRC(lyrics, vocalSegments);
        
        updateProgress(90, 'Finalisiere...');
        createDownload(lrcContent);
        
        updateProgress(100, 'Fertig!');
        document.getElementById('resultContainer').hidden = false;

    } catch (error) {
        alert(`Fehler: ${error.message}`);
        updateProgress(0, '');
    }
}

async function detectVocals(peaks) {
    // KI-Analyse
    const tensor = tf.tensor3d([peaks]);
    const prediction = await model.predict(tensor);
    const results = await prediction.data();
    
    // Segmentierung
    const segments = [];
    let currentSegment = null;
    const threshold = 0.75;

    results.forEach((confidence, index) => {
        const time = index / 100; // 10ms Schritte
        
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

function generateLRC(lyrics, segments) {
    let lrc = '[re:AI-generated]\n';
    let lineIndex = 0;
    
    segments.forEach(segment => {
        const duration = segment.end - segment.start;
        const linesInSegment = Math.ceil(lyrics.length * (duration / getTotalDuration(segments)));
        
        for (let i = 0; i < linesInSegment; i++) {
            if (lineIndex >= lyrics.length) break;
            const timestamp = segment.start + (i * (duration / linesInSegment));
            lrc += `[${formatTime(timestamp)}] ${lyrics[lineIndex]}\n`;
            lineIndex++;
        }
    });
    
    return lrc;
}

function createDownload(content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    document.getElementById('downloadBtn').href = url;
    document.getElementById('downloadBtn').download = `${state.currentFile.name.replace(/\.[^/.]+$/, "")}_synced.lrc`;
}

function resetApp() {
    removeFile();
    document.getElementById('lyricsInput').value = '';
    document.getElementById('resultContainer').hidden = true;
    wavesurfer.empty();
    updateProgress(0, '');
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

function updateProgress(percent, text) {
    document.querySelector('.progress-fill').style.width = `${percent}%`;
    document.querySelector('.progress').setAttribute('data-status', text);
}
