let audioBuffer;
let audioDuration;

document.getElementById('audioUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);
    const audioPlayer = document.getElementById('audioPlayer');
    
    audioPlayer.src = url;
    audioPlayer.hidden = false;
    
    audioPlayer.onloadedmetadata = () => {
        audioDuration = audioPlayer.duration;
    };
});

function processFiles() {
    const lyrics = document.getElementById('lyricsInput').value.split('\n');
    const lrcContent = generateLRC(lyrics);
    
    const blob = new Blob([lrcContent], {type: 'text/plain'});
    const downloadLink = document.getElementById('downloadLink');
    
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = 'synced_lyrics.lrc';
    downloadLink.hidden = false;
}

function generateLRC(lyrics) {
    let lrc = '[ti:Synchronisierter Song]\n';
    const interval = audioDuration / lyrics.length;
    
    return lyrics.reduce((acc, line, index) => {
        const minutes = Math.floor((index * interval) / 60);
        const seconds = ((index * interval) % 60).toFixed(2);
        return acc + `[${minutes.toString().padStart(2, '0')}:${seconds.padStart(5, '0')}] ${line}\n`;
    }, lrc);
}
