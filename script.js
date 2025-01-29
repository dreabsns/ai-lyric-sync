// script.js
// Vorheriger Code hier

async function handleAudioFile(file) {
    try {
        // UI Updates
        document.getElementById('dropZone').classList.add('disabled');
        document.getElementById('filePreview').classList.add('active');
        document.getElementById('fileName').textContent = file.name;
        document.getElementById('fileSize').textContent = formatFileSize(file.size);
        
        // Audio verarbeiten
        const url = URL.createObjectURL(file);
        await wavesurfer.load(url);
        updateStatus('Audio geladen', 40);
    } catch (error) {
        showError('Audiofehler: ' + error.message);
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function removeFile() {
    // Reset UI
    document.getElementById('filePreview').classList.remove('active');
    document.getElementById('dropZone').classList.remove('disabled');
    document.getElementById('audioInput').value = '';
    wavesurfer.empty();
    updateStatus('Bereit', 0);
}

// Event Listener für das versteckte Datei-Input
document.querySelector('.btn-browse').addEventListener('click', () => {
    document.getElementById('audioInput').click();
});

// Drag & Drop Handling
document.getElementById('dropZone').addEventListener('dragover', (e) => {
    if (!document.getElementById('filePreview').classList.contains('active')) {
        e.preventDefault();
        e.currentTarget.style.background = 'rgba(108,92,231,0.1)';
    }
});

document.getElementById('dropZone').addEventListener('dragleave', (e) => {
    e.currentTarget.style.background = '';
});

document.getElementById('dropZone').addEventListener('drop', async (e) => {
    e.preventDefault();
    if (!document.getElementById('filePreview').classList.contains('active')) {
        const file = e.dataTransfer.files[0];
        if (file) handleAudioFile(file);
    }
    e.currentTarget.style.background = '';
});
