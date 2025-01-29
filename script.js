// script.js
const uploadContainer = document.getElementById('uploadContainer');
const filePreview = document.getElementById('filePreview');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const fileInput = document.getElementById('fileInput');

// Datei hochladen
fileInput.addEventListener('change', handleFileSelect);
uploadContainer.addEventListener('dragover', handleDragOver);
uploadContainer.addEventListener('drop', handleFileDrop);

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) processFile(file);
}

function handleDragOver(e) {
    e.preventDefault();
    uploadContainer.style.backgroundColor = 'rgba(108,92,231,0.1)';
}

function handleFileDrop(e) {
    e.preventDefault();
    uploadContainer.style.backgroundColor = '';
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
}

function processFile(file) {
    if (!file.type.startsWith('audio/')) {
        alert('Bitte nur Audio-Dateien hochladen!');
        return;
    }

    // UI aktualisieren
    filePreview.classList.add('active');
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    
    // Dateiinput zurücksetzen für mögliche neue Uploads
    fileInput.value = '';
}

function removeFile() {
    // UI zurücksetzen
    filePreview.classList.remove('active');
    fileName.textContent = '';
    fileSize.textContent = '';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const units = ['Bytes', 'KB', 'MB', 'GB'];
    const exponent = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, exponent)).toFixed(2)) + ' ' + units[exponent];
}
