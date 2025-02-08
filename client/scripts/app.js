// client/scripts/app.js
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

// Hilfsfunktionen
function showError(message) {
  console.error(`[Error] ${message}`);
  document.getElementById('errorMessage').textContent = message;
  document.getElementById('errorPopup').style.display = 'flex';
  resetUI();
}

function closeError() {
  document.getElementById('errorPopup').style.display = 'none';
}

function formatTime(seconds) {
  const date = new Date(0);
  date.setSeconds(seconds);
  return date.toISOString().substring(14, 23).replace('.', ',');
}

function audioBufferToBase64(buffer) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    const wavBlob = new Blob([buffer], { type: 'audio/wav' });
    reader.readAsDataURL(wavBlob);
    reader.onloadend = () => {
      const base64data = reader.result.split(',')[1];
      resolve(base64data);
    };
  });
}

// Audio-Verarbeitung
async function transcribeAudio(buffer) {
  try {
    const base64Audio = await audioBufferToBase64(buffer);
    
    const response = await fetch(WHISPER_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audio: base64Audio,
        model: WHISPER_CONFIG.currentModel,
        precision: WHISPER_CONFIG.precision
      })
    });
    
    if (!response.ok) throw new Error('Transkription fehlgeschlagen');
    return response.json();
  } catch (error) {
    throw new Error(`API Fehler: ${error.message}`);
  }
}

// UI-Funktionen
function updateUI(status, progress) {
  document.getElementById('processBtn').innerHTML = `<i class="fas fa-robot"></i> ${status}`;
  document.getElementById('progressBar').style.width = `${progress}%`;
}

function resetUI() {
  document.getElementById('progressBar').style.width = '0%';
  document.getElementById('processBtn').innerHTML = 
    `<i class="fas fa-robot"></i> Lyrics synchronisieren`;
  document.getElementById('downloadSection').style.display = 'none';
  document.getElementById('languageBadge').style.display = 'none';
  document.getElementById('whisperStatus').style.display = 'none';
}

function createDownload(content) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  document.getElementById('downloadBtn').href = url;
}

// Lyrics-Verarbeitung
function generateLRC(lyrics, words) {
  let lrc = '[re:AI Synchronized]\n';
  let wordIndex = 0;
  
  lyrics.forEach(line => {
    const lineWords = line.split(' ');
    const lineStart = words[wordIndex]?.start || 0;
    
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

// Player-Funktionen
function updateLyricsPreview() {
  const preview = document.getElementById('lyricsPreview');
  preview.classList.add('loading-preview');
  
  activeElements.forEach(element => element.classList.remove('active'));
  activeElements.clear();

  preview.innerHTML = `
    <div class="time-marker" id="timeMarker">00:00</div>
    ${lyricData.map(line => `
      <div class="lyric-line" 
          data-line-id="${line.id}"
          data-start="${line.start}" 
          data-end="${line.end}">
        ${line.words.map(word => `
          <span class="word-highlight" 
                data-word-id="${word.id}"
                data-start="${word.start}" 
                data-end="${word.end}">
            ${word.word}
          </span>
        `).join(' ')}
      </div>
    `).join('')}
  `;

  preview.scrollTo({ top: 0, behavior: 'auto' });
  preview.classList.remove('loading-preview');
}

function updatePlayback() {
  if (!isPreviewActive) return;

  const time = wavesurfer.getCurrentTime();
  const marker = document.getElementById('timeMarker');
  if (marker) marker.textContent = formatTime(time);

  const newActiveElements = new Set();

  lyricData.forEach(line => {
    const lineElement = document.querySelector(`[data-line-id="${line.id}"]`);
    const isLineActive = time >= line.start && time <= line.end;

    if (isLineActive) {
      lineElement.classList.add('active');
      newActiveElements.add(lineElement);

      line.words.forEach(word => {
        const wordElement = document.querySelector(`[data-word-id="${word.id}"]`);
        if (time >= word.start && time <= word.end) {
          const progress = (time - word.start) / (word.end - word.start);
          wordElement.style.setProperty('--progress', `${progress * 100}%`);
          wordElement.classList.add('active');
          newActiveElements.add(wordElement);
        }
      });
    }
  });

  activeElements.forEach(element => {
    if (!newActiveElements.has(element)) {
      element.classList.remove('active');
      if (element.classList.contains('word-highlight')) {
        element.style.removeProperty('--progress');
      }
    }
  });
  activeElements = newActiveElements;

  const activeLine = document.querySelector('.lyric-line.active');
  if (activeLine) {
    const container = document.getElementById('lyricsPreview');
    const lineTop = activeLine.offsetTop;
    const lineHeight = activeLine.offsetHeight;
    const containerHeight = container.offsetHeight;
    
    container.scrollTo({
      top: lineTop - (containerHeight / 2) + (lineHeight / 2),
      behavior: 'smooth'
    });
  }

  animationFrameId = requestAnimationFrame(() => updatePlayback());
}

// Event-Handler
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

// Initialisierung
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

  // Event-Listener
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
});

function selectModel(modelId) {
  WHISPER_CONFIG.currentModel = modelId;
  document.querySelectorAll('.model-option').forEach(el => 
    el.classList.remove('active')
  );
  event.target.classList.add('active');
  document.getElementById('currentModel').textContent = modelId;
}
