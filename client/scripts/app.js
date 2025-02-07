let wavesurfer = null;
let audioBuffer = null;
let isProcessing = false;
let lyricData = [];
let isPreviewActive = false;
let activeElements = new Set();
let animationFrameId = null;

const WHISPER_CONFIG = {
    endpoint: 'http://localhost:3001/api/transcribe',
    currentModel: 'whisper-large-v3',
    precision: 0.8
};

function showError(message) {
    console.error(`[Error] ${message}`);
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorPopup').style.display = 'flex';
    resetUI();
}

function closeError() {
    document.getElementById('errorPopup').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: '#6c5ce7',
        progressColor: '#4b4bff',
        height: 150,
        responsive: true,
        normalize: true,
        cursorColor: '#ffffff',
        cursorWidth: 2,
        barWidth: 3,
        barGap: 2,
        partialRender: true,
        interact: true
    });

    wavesurfer.on('play', () => {
        document.querySelector('#playButton i').classList.replace('fa-play', 'fa-pause');
        if (isPreviewActive) animationFrameId = requestAnimationFrame(() => updatePlayback());
    });

    wavesurfer.on('pause', () => {
        document.querySelector('#playButton i').classList.replace('fa-pause', 'fa-play');
        cancelAnimationFrame(animationFrameId);
    });

    wavesurfer.on('seek', () => {
        if (isPreviewActive) updatePlayback();
    });
});

function selectModel(modelId) {
    WHISPER_CONFIG.currentModel = modelId;
    document.querySelectorAll('.model-option').forEach(el => 
        el.classList.remove('active')
    );
    event.target.classList.add('active');
    document.getElementById('currentModel').textContent = modelId;
}

async function startProcessing() {
    try {
        if (isProcessing) return;
        isProcessing = true;
        document.getElementById('whisperStatus').style.display = 'block';
        
        const lyrics = document.getElementById('lyricsInput').value.split('\n').filter(l => l.trim());
        if (!audioBuffer) throw new Error('Bitte Audio-Datei hochladen');
        if (lyrics.length === 0) throw new Error('Bitte Lyrics eingeben');

        updateUI('Analysiere Audio mit Whisper...', 20);
        const { words, language } = await transcribeAudio(audioBuffer);
        
        document.getElementById('languageBadge').style.display = 'block';
        document.getElementById('languageBadge').textContent = 
            `Erkannte Sprache: ${language.toUpperCase()}`;

        updateUI('Synchronisiere Lyrics...', 60);
        const lrcContent = generateLRC(lyrics, words);
        
        preparePreview(lyrics, words);
        document.getElementById('previewButton').style.display = 'block';
        
        createDownload(lrcContent);
        updateUI('Fertig!', 100);
        document.getElementById('downloadSection').style.display = 'block';
        isProcessing = false;

    } catch (error) {
        showError(error.message);
        resetUI();
        isProcessing = false;
    }
}

async function transcribeAudio(buffer) {
    const wavBlob = await audioBufferToWav(buffer);
    
    const formData = new FormData();
    formData.append('audio', wavBlob, 'recording.wav');
    formData.append('model', WHISPER_CONFIG.currentModel);
    formData.append('precision', WHISPER_CONFIG.precision);

    try {
        const response = await fetch(WHISPER_CONFIG.endpoint, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Transkription fehlgeschlagen');
        return response.json();
    } catch (error) {
        throw new Error(`Whisper API Fehler: ${error.message}`);
    }
}

function audioBufferToWav(buffer) {
    return new Promise((resolve) => {
        const numChannels = 1;
        const sampleRate = buffer.sampleRate;
        const format = 1;
        const bitDepth = 16;

        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;

        const wavBuffer = new ArrayBuffer(44 + buffer.length * 2);
        const view = new DataView(wavBuffer);

        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + buffer.length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        writeString(36, 'data');
        view.setUint32(40, buffer.length * 2, true);

        const floatTo16Bit = (output, offset, input) => {
            for (let i = 0; i < input.length; i++, offset += 2) {
                const s = Math.max(-1, Math.min(1, input[i]));
                output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            }
        };

        const channelData = buffer.getChannelData(0);
        const wavBytes = new DataView(wavBuffer);
        floatTo16Bit(wavBytes, 44, channelData);

        resolve(new Blob([wavBuffer], { type: 'audio/wav' }));
    });
}

function generateLRC(lyrics, words) {
    let lrc = '[re:AI Synchronized]\n';
    let wordIndex = 0;
    
    lyrics.forEach(line => {
        const lineWords = line.split(' ');
        const lineStart = words[wordIndex]?.start || 0;
        const lineEnd = words[Math.min(wordIndex + lineWords.length - 1, words.length - 1)]?.end || 0;
        
        lrc += `[${formatTime(lineStart)}] ${line}\n`;
        wordIndex += lineWords.length;
    });

    const fileName = document.getElementById('fileName').textContent
        .replace(/\.[^/.]+$/, "")
        .replace(/[^\wäöüß-]/gi, '_')
        .toLowerCase();

    document.getElementById('downloadBtn').download = `${fileName}.lrc`;
    return lrc;
}

function preparePreview(lyrics, words) {
    lyricData = [];
    let wordIndex = 0;

    lyrics.forEach((line, index) => {
        const lineWords = line.split(' ');
        const wordTimings = lineWords.map(word => {
            const timing = words[wordIndex++] || { start: 0, end: 0 };
            return { 
                word,
                start: timing.start,
                end: timing.end,
                id: Date.now() + Math.random()
            };
        });

        lyricData.push({
            id: Date.now() + Math.random(),
            line,
            words: wordTimings,
            start: wordTimings[0]?.start || 0,
            end: wordTimings[wordTimings.length - 1]?.end || 0
        });
    });

    updateLyricsPreview();
}

function formatTime(seconds) {
    const date = new Date(0);
    date.setSeconds(seconds);
    return date.toISOString().substring(14, 23).replace('.', ',');
}

function togglePlay() {
    wavesurfer.playPause();
}

function togglePreview() {
    const previewContainer = document.querySelector('.preview-container');
    isPreviewActive = !isPreviewActive;
    previewContainer.style.display = isPreviewActive ? 'block' : 'none';
    document.getElementById('previewButton').style.background = 
        isPreviewActive ? 'var(--danger)' : 'var(--success)';
    
    if (isPreviewActive && wavesurfer.isPlaying()) {
        animationFrameId = requestAnimationFrame(() => updatePlayback());
    }
}

async function handleFileUpload(e) {
    try {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('audio/')) {
            throw new Error('Ungültiges Dateiformat. Nur Audio-Dateien sind erlaubt.');
        }

        document.getElementById('fileName').textContent = file.name;
        document.getElementById('fileDisplay').style.display = 'flex';
        document.getElementById('uploadButton').style.display = 'none';

        const audioContext = new AudioContext();
        const arrayBuffer = await file.arrayBuffer();
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        wavesurfer.load(URL.createObjectURL(file));
        document.getElementById('playControls').style.display = 'flex';

    } catch (error) {
        showError(`Dateiverarbeitung fehlgeschlagen: ${error.message}`);
        removeFile();
    }
}

function removeFile() {
    try {
        document.getElementById('fileInput').value = '';
        document.getElementById('fileDisplay').style.display = 'none';
        document.getElementById('uploadButton').style.display = 'block';
        if(wavesurfer) wavesurfer.empty();
        audioBuffer = null;
        lyricData = [];
        document.getElementById('playControls').style.display = 'none';
        document.getElementById('previewButton').style.display = 'none';
        document.querySelector('.preview-container').style.display = 'none';
        document.getElementById('languageBadge').style.display = 'none';
        document.getElementById('lyricsPreview').innerHTML = '';
        document.getElementById('whisperStatus').style.display = 'none';
        cancelAnimationFrame(animationFrameId);
        
        setTimeout(() => location.reload(), 300);
    } catch (error) {
        showError(error.message);
    }
}

function updateUI(status, progress) {
    document.getElementById('processBtn').innerHTML = `<i class="fas fa-robot"></i> ${status}`;
    document.getElementById('progressBar').style.width = `${progress}%`;
}

function createDownload(content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    document.getElementById('downloadBtn').href = url;
}

function resetUI() {
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('processBtn').innerHTML = 
        `<i class="fas fa-robot"></i> Lyrics synchronisieren`;
    document.getElementById('downloadSection').style.display = 'none';
    document.getElementById('languageBadge').style.display = 'none';
    document.getElementById('whisperStatus').style.display = 'none';
}

// Event Listeners
document.getElementById('fileInput').addEventListener('change', handleFileUpload);
document.getElementById('precisionSlider').addEventListener('input', e => {
    WHISPER_CONFIG.precision = parseFloat(e.target.value);
});

const dropZone = document.getElementById('dropZone');
dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload({ target: { files: [file] } });
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeError();
});
