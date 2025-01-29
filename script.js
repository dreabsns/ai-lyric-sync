document.getElementById('audioUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);
    const audioPlayer = document.getElementById('audioPlayer');
    audioPlayer.src = url;
    audioPlayer.hidden = false;
});

async function processFiles() {
    document.getElementById('loader').style.display = 'block';
    
    // 1. Audio analysieren
    const audioFile = document.getElementById('audioUpload').files[0];
    const audioPlayer = document.getElementById('audioPlayer');
    
    // 2. Lyrics aufbereiten
    const rawLyrics = document.getElementById('lyricsInput').value
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.replace(/[\(\[].*?[\)\]]/g, '').trim());
    
    // 3. Zeitstempel generieren (Mock-Funktion)
    const lrcContent = await generateLRC(rawLyrics, audioPlayer.duration);
    
    // 4. Download
    const blob = new Blob([lrcContent], {type: 'text/plain'});
    const downloadLink = document.getElementById('downloadLink');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = 'lyrics.lrc';
    downloadLink.hidden = false;
    document.getElementById('loader').style.display = 'none';
}

// Vereinfachte LRC-Generierung
async function generateLRC(lyrics, duration) {
    let lrc = '[ti:Synchronisierte Lyrics]\n';
    const startOffset = 2.0; // 2 Sekunden Offset gegen vorzeitigen Start
    
    lyrics.forEach((line, index) => {
        const time = startOffset + (index * (duration / lyrics.length));
        const minutes = Math.floor(time / 60).toString().padStart(2, '0');
        const seconds = (time % 60).toFixed(2).padStart(5, '0');
        lrc += `[${minutes}:${seconds}] ${line}\n`;
    });
    
    return lrc;
}
