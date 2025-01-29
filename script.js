const state = {
    currentFile: null
};

const uploadContainer = document.getElementById('uploadContainer');
const filePreview = document.getElementById('filePreview');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');

// Event Listener
fileInput.addEventListener('change', handleFileSelect);
uploadContainer.addEventListener('dragover', handleDragOver);
uploadContainer.addEventListener('drop', handleFileDrop);
uploadContainer.addEventListener('dragleave', handleDragLeave);

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) processFile(file);
}

function handleDragOver(e) {
    e.preventDefault();
    if (!state.currentFile) {
        uploadContainer.style.backgroundColor = 'rgba(108,92,231,0.1)';
    }
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadContainer.style.backgroundColor = '';
}

function handleFileDrop(e) {
    e.preventDefault();
    uploadContainer.style.backgroundColor = '';
    
    if (state.currentFile) return;
    
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
}

function processFile(file) {
    if (!file.type.startsWith('audio/')) {
        alert('Bitte nur Audio-Dateien (MP3, WAV) hochladen!');
        fileInput.value = '';
        return;
    }

    state.currentFile = file;
    
    // UI aktualisieren
    filePreview.classList.add('active');
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    dropZone.classList.add('disabled');
}

function removeFile() {
    state.currentFile = null;
    filePreview.classList.remove('active');
    fileName.textContent = '';
    fileSize.textContent = '';
    fileInput.value = '';
    dropZone.classList.remove('disabled');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const units = ['Bytes', 'KB', 'MB', 'GB'];
    const exponent = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, exponent)).toFixed(2)) + ' ' + units[exponent];
}
