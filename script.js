let audioContext;
let audioBuffer;
const SILENCE_THRESHOLD = 0.02; // Anpassbarer Wert für Stille-Erkennung

document.getElementById('audioUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);
    const audioPlayer = document.getElementById('audioPlayer');
    
    audioPlayer.src = url;
    audioPlayer.hidden = false;
});

async function processFiles() {
    document.getElementById('loader').style.display = 'block';
    
    try {
        // 1. Audio analysieren
        const audioFile = document.getElementById('audioUpload').files[0];
        const arrayBuffer = await audioFile.arrayBuffer();
        audioContext = new AudioContext();
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // 2. Stille und Gesang erkennen
        const {vocalSegments, silenceSegments} = await analyzeAudio(audioBuffer);
        
        // 3. Lyrics verarbeiten
        const rawLyrics = document.getElementById('lyricsInput').value;
        const cleanedLyrics = cleanLyrics(rawLyrics);
        
        // 4. Intelligente LRC generieren
        const lrcContent = await generateSmartLRC(cleanedLyrics, vocalSegments, silenceSegments);
        
        // 5. Download
        const blob = new Blob([lrcContent], {type: 'text/plain'});
        document.getElementById('downloadLink').href = URL.createObjectURL(blob);
        document.getElementById('downloadLink').download = `${audioFile.name.split('.')[0]}_synced.lrc`;
        document.getElementById('downloadLink').hidden = false;

    } catch (error) {
        alert('Fehler: ' + error.message);
    } finally {
        document.getElementById('loader').style.display = 'none';
    }
}

async function analyzeAudio(buffer) {
    // Analyse der Rohdaten auf Stille
    const rawData = buffer.getChannelData(0);
    const sampleWindow = 0.1; // 100ms Fenster
    const windowSize = Math.floor(sampleWindow * buffer.sampleRate);
    
    let isSilent = false;
    let silenceSegments = [];
    let currentSilenceStart = 0;
    
    // TensorFlow-Modell für Vokaldetektion
    const model = await tf.loadGraphModel('https://storage.googleapis.com/vocal-detection-model/v2/model.json');
    
    // Gesangserkennung
    const vocalSegments = await model.predict(tf.tensor([rawData]));
    
    // Stille erkennen
    for (let i = 0; i < rawData.length; i += windowSize) {
        const slice = rawData.slice(i, i + windowSize);
        const rms = Math.sqrt(slice.reduce((sum, x) => sum + x * x, 0) / slice.length);
        
        if (rms < SILENCE_THRESHOLD && !isSilent) {
            currentSilenceStart = i / buffer.sampleRate;
            isSilent = true;
        } else if (rms >= SILENCE_THRESHOLD && isSilent) {
            silenceSegments.push({
                start: currentSilenceStart,
                end: i / buffer.sampleRate
            });
            isSilent = false;
        }
    }
    
    return {
        vocalSegments: vocalSegments.arraySync()[0],
        silenceSegments: silenceSegments
    };
}

function cleanLyrics(text) {
    return text
        .split('\n')
        .map(line => line
            .replace(/\(.*?\)/g, '') // Adlibs entfernen
            .replace(/\[.*?\]/g, '') // Markierungen entfernen
            .trim()
        )
        .filter(line => line.length > 0);
}

async function generateSmartLRC(lyrics, vocalSegments, silenceSegments) {
    let lrc = '[ti:Synchronisierter Song]\n';
    let lyricIndex = 0;
    let allSegments = [...vocalSegments, ...silenceSegments]
        .sort((a, b) => a.start - b.start);
    
    for (const segment of allSegments) {
        if (segment.type === 'silence') {
            // Leerzeile für Stille
            lrc += `[${formatTime(segment.start)}] \n`;
        } else {
            // Lyrics auf Gesang verteilen
            const duration = segment.end - segment.start;
            const linesInSegment = Math.max(1, Math.floor(lyrics.length * (duration / audioBuffer.duration)));
            
            for (let i = 0; i < linesInSegment; i++) {
                if (lyricIndex >= lyrics.length) break;
                const timestamp = segment.start + (i * (duration / linesInSegment));
                lrc += `[${formatTime(timestamp)}] ${lyrics[lyricIndex]}\n`;
                lyricIndex++;
            }
        }
    }
    
    return lrc;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toFixed(2).padStart(5, '0');
    return `${mins}:${secs}`;
}
