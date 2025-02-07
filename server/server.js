require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const FormData = require('form-data');
const { Readable } = require('stream');
const bodyParser = require('body-parser');
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Whisper API Endpoint
app.post('/api/transcribe', async (req, res) => {
  try {
    // Validate input
    if (!req.body.audio) {
      throw new Error('No audio data received');
    }

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(req.body.audio, 'base64');
    
    // Create FormData for OpenAI
    const formData = new FormData();
    const audioStream = Readable.from(audioBuffer);
    
    formData.append('file', audioStream, {
      filename: 'recording.wav',
      contentType: 'audio/wav'
    });
    formData.append('model', req.body.model || 'whisper-1');
    formData.append('response_format', 'verbose_json');

    // Call OpenAI API
    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          ...formData.getHeaders()
        }
      }
    );

    // Process response
    const words = response.data.segments.flatMap(segment => 
      segment.words.map(word => ({
        word: word.word,
        start: word.start,
        end: word.end
      }))
    );

    res.json({
      language: response.data.language,
      words: words
    });

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Transcription failed',
      details: error.response?.data?.error?.message || error.message
    });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
