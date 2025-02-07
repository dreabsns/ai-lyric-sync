// Transcribe Audio Funktion aktualisiert
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

// Neue Hilfsfunktion
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
