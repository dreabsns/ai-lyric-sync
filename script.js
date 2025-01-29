let model;
const MIN_VOCAL_LOUDNESS = 0.15; // Anpassbar für bessere Ergebnisse

async function loadModel() {
    model = await tf.automl.loadAudioClassification('https://storage.googleapis.com/tfjs-models/tfjs/speech_commands/v0.5/browser_fft/18w/model.json');
}

async function analyzeAudio(audioBuffer) {
    const audioData = audioBuffer.getChannelData(0);
    const windowSize = 44100 * 1; // 1-Sekunden-Fenster
    const predictions = [];

    for (let i = 0; i < audioData.length; i += windowSize) {
        const slice = audioData.slice(i, i + windowSize);
        const input = tf.tensor(slice).reshape([-1, 44100]);
        const prediction = await model.classify(input);
        predictions.push({
            time: i / 44100,
            isVocal: prediction[0].label === '_background_noise_' ? 0 : prediction[0].prob
        });
        tf.dispose(input);
    }
    
    return predictions;
}

async function startProcessing() {
    const audioFile = document.getElementById('audioInput').files[0];
    const lyrics = document.getElementById('lyricsInput').value.split('\n').filter(l => l.trim());
    
    if (!audioFile || lyrics.length === 0) {
        alert('Bitte Audio und Lyrics hochladen!');
        return;
    }

    document.getElementById('progressBar').style.width = '0%';
    await loadModel();

    // Audio analysieren
    const audioContext = new AudioContext();
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const analysis = await analyzeAudio(audioBuffer);

    // Lyrics verteilen
    const lrcContent = syncLyrics(analysis, lyrics, audioBuffer.duration);
    
    // Download vorbereiten
    const blob = new Blob([lrcContent], {type: 'text/plain'});
    const downloadBtn = document.getElementById('downloadBtn');
    downloadBtn.href = URL.createObjectURL(blob);
    downloadBtn.download = `${audioFile.name.split('.')[0]}_synced.lrc`;
    downloadBtn.hidden = false;
}

function syncLyrics(analysis, lyrics, duration) {
    let lrc = '[re:AI-generated sync]\n';
    const vocalSegments = analysis.filter(a => a.isVocal > MIN_VOCAL_LOUDNESS);
    const lyricsPerSegment = Math.ceil(lyrics.length / vocalSegments.length);
    let lyricIndex = 0;

    vocalSegments.forEach((segment, index) => {
        const timestamp = formatTime(segment.time);
        const endTime = index < vocalSegments.length - 1 
            ? vocalSegments[index + 1].time 
            : duration;

        for (let i = 0; i < lyricsPerSegment; i++) {
            if (lyricIndex >= lyrics.length) break;
            lrc += `[${timestamp}] ${lyrics[lyricIndex]}\n`;
            lyricIndex++;
        }

        // Leerzeilen für Pausen
        if (index < vocalSegments.length - 1) {
            const pauseDuration = vocalSegments[index + 1].time - endTime;
            if (pauseDuration > 2) {
                lrc += `[${formatTime(endTime)}] \n`;
            }
        }
    });

    return lrc;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toFixed(2).padStart(5, '0');
    return `${mins}:${secs}`;
}
