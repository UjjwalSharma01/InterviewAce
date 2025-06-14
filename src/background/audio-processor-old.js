// Audio processor for handling real-time transcription with AssemblyAI
class AudioProcessor {
  constructor() {
    this.isProcessing = false;
    this.micStream = null;
    this.audioContext = null;
    this.assemblyaiWebsocket = null;
    this.apiKey = null;
    this.onTranscriptUpdate = null;
    this.onSpeakerDetected = null;
    this.micActive = false;
    this.audioBuffers = [];
    this.bufferInterval = null;
    this.transcripts = [];
    this.speakerDetectionThrottle = null;
    this.sessionId = null;
    this.currentTurn = '';
    this.API_ENDPOINT_BASE_URL = 'wss://streaming.assemblyai.com/v3/ws';
  }
  
  // Initialize the audio processor
  async initialize(assemblyaiApiKey) {
    this.apiKey = assemblyaiApiKey;
    
    if (!this.apiKey) {
      throw new Error('AssemblyAI API key is required');
    }
    
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000
    });
    
    return this;
  }
  
  // Start audio processing and transcription
  async startProcessing(onTranscriptUpdate, onSpeakerDetected) {
    if (this.isProcessing) {
      throw new Error('Audio processing already started');
    }
    
    if (!this.apiKey) {
      throw new Error('AssemblyAI API key is required');
    }
    
    this.onTranscriptUpdate = onTranscriptUpdate;
    this.onSpeakerDetected = onSpeakerDetected;
    this.isProcessing = true;
    
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      this.micStream = stream;
      
      // Set up audio processing pipeline
      const micSource = this.audioContext.createMediaStreamSource(stream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      
      micSource.connect(analyser);
      
      // Create processor node for collecting audio data
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (!this.isProcessing) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        const audioData = new Float32Array(inputData);
        this.audioBuffers.push(audioData);
      };
      
      analyser.connect(processor);
      processor.connect(this.audioContext.destination);
      
      // Start the AssemblyAI WebSocket connection
      await this.connectToAssemblyAI();
      
      // Start audio buffer processing (send every 250ms)
      this.bufferInterval = setInterval(() => this.processAudioBuffers(), 250);
      
      // Start speaker detection
      this.speakerDetectionThrottle = setInterval(() => {
        this.detectSpeaker(analyser);
      }, 100);
      
      return true;
    } catch (error) {
      console.error('Error starting audio processing:', error);
      this.isProcessing = false;
      throw error;
    }
  }
  
  // Stop audio processing
  async stopProcessing() {
    if (!this.isProcessing) return;
    
    this.isProcessing = false;
    
    // Clear intervals
    clearInterval(this.bufferInterval);
    clearInterval(this.speakerDetectionThrottle);
    
    // Stop microphone stream
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    
    // Close WebSocket connection
    if (this.assemblyaiWebsocket) {
      this.assemblyaiWebsocket.close();
      this.assemblyaiWebsocket = null;
    }
    
    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }
    
    return true;
  }
  
  // Connect to AssemblyAI WebSocket for real-time transcription
  async connectToAssemblyAI() {
    return new Promise((resolve, reject) => {
      // Close existing connection if any
      if (this.assemblyaiWebsocket) {
        this.assemblyaiWebsocket.close();
      }
      
      // Set up connection parameters for AssemblyAI v3 streaming API
      const CONNECTION_PARAMS = {
        sample_rate: 16000,
        format_turns: true, // Request formatted final transcripts
      };
      
      // Build WebSocket URL with query parameters
      const queryString = new URLSearchParams(CONNECTION_PARAMS).toString();
      const wsUrl = `${this.API_ENDPOINT_BASE_URL}?${queryString}`;
      
      console.log('Connecting to AssemblyAI:', wsUrl);
      
      // Create WebSocket connection with proper headers
      this.assemblyaiWebsocket = new WebSocket(wsUrl, {
        headers: {
          'Authorization': this.apiKey
        }
      });
      
      this.assemblyaiWebsocket.onopen = () => {
        console.log('AssemblyAI WebSocket connection opened');
        resolve();
      };
      
      this.assemblyaiWebsocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleAssemblyAIMessage(data);
        } catch (error) {
          console.error('Error parsing AssemblyAI message:', error);
        }
      };
      
      this.assemblyaiWebsocket.onerror = (error) => {
        console.error('AssemblyAI WebSocket error:', error);
        reject(error);
      };
      
      this.assemblyaiWebsocket.onclose = (event) => {
        console.log('AssemblyAI WebSocket closed:', event.code, event.reason);
      };
    });
  }
  
  // Handle AssemblyAI v3 streaming messages
  handleAssemblyAIMessage(data) {
    const msgType = data.type;
    
    if (msgType === 'Begin') {
      this.sessionId = data.id;
      const expiresAt = data.expires_at;
      console.log(`AssemblyAI session began: ID=${this.sessionId}, ExpiresAt=${new Date(expiresAt * 1000).toISOString()}`);
    } 
    else if (msgType === 'Turn') {
      const transcript = data.transcript || '';
      const isFormatted = data.turn_is_formatted;
      
      if (transcript.trim()) {
        // Create transcript object
        const transcriptObj = {
          id: Date.now().toString(),
          text: transcript,
          confidence: 0.9, // AssemblyAI v3 doesn't provide confidence in turns
          speaker: 'unknown', // Will be determined by our speaker detection
          isFinal: isFormatted,
          timestamp: Date.now()
        };
        
        if (isFormatted) {
          // This is a complete turn - likely a question
          console.log('Final transcript:', transcript);
          this.handleTranscript(transcriptObj);
          this.currentTurn = '';
        } else {
          // Partial transcript - accumulate
          this.currentTurn = transcript;
        }
      }
    }
    else if (msgType === 'Termination') {
      const audioDuration = data.audio_duration_seconds;
      const sessionDuration = data.session_duration_seconds;
      console.log(`AssemblyAI session terminated: Audio=${audioDuration}s, Session=${sessionDuration}s`);
    }
    else {
      console.log('Unknown AssemblyAI message type:', msgType, data);
    }
  }
  
  // Process audio buffers and send to AssemblyAI
  processAudioBuffers() {
    if (!this.isProcessing || !this.assemblyaiWebsocket) return;
    
    if (this.audioBuffers.length === 0) return;
    
    // Concatenate all accumulated buffers
    let allSamples = [];
    for (const buffer of this.audioBuffers) {
      allSamples = allSamples.concat(Array.from(buffer));
    }
    
    // Clear buffer after processing
    this.audioBuffers = [];
    
    // Convert to 16-bit PCM
    const pcmData = new Int16Array(allSamples.length);
    for (let i = 0; i < allSamples.length; i++) {
      pcmData[i] = Math.min(1, Math.max(-1, allSamples[i])) * 32767;
    }
    
    // Send raw PCM data to AssemblyAI v3 WebSocket (not JSON)
    if (this.assemblyaiWebsocket.readyState === WebSocket.OPEN) {
      // Convert Int16Array to ArrayBuffer and send as binary data
      this.assemblyaiWebsocket.send(pcmData.buffer);
    }
  }
  
  // Handle transcript from AssemblyAI (updated for v3 API)
  handleTranscript(transcript) {
    if (!transcript.text || transcript.text.trim() === '') return;
    
    // Determine speaker based on our audio level detection
    if (this.micActive) {
      transcript.speaker = 'user';
    } else {
      transcript.speaker = 'interviewer';
    }
    
    // Update transcripts array
    if (transcript.isFinal) {
      // Add final transcript
      this.transcripts.push(transcript);
      
      // Limit transcripts array size (keep only last 50)
      if (this.transcripts.length > 50) {
        this.transcripts = this.transcripts.slice(-50);
      }
    }
    
    // Notify listeners
    if (this.onTranscriptUpdate) {
      this.onTranscriptUpdate(transcript, this.transcripts);
    }
  }
  
  // Detect speaker based on audio level (improved sensitivity)
  detectSpeaker(analyser) {
    if (!this.isProcessing || !analyser) return;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate average level
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    
    const average = sum / dataArray.length;
    const normalizedLevel = average / 255; // Normalize to 0-1 range
    
    // Improved speaker detection with lower thresholds
    const wasMicActive = this.micActive;
    let speaker = 'unknown';
    
    // Check if microphone is active (user speaking) - lowered threshold
    if (normalizedLevel > 0.15) {
      speaker = 'user';
      this.micActive = true;
    } else if (normalizedLevel > 0.08) {
      // If mic level is low but there's some audio,
      // it's likely the interviewer speaking through speakers
      speaker = 'interviewer';  
      this.micActive = false;
    } else {
      this.micActive = false;
    }
    
    // Notify listeners with enhanced data
    if (this.onSpeakerDetected) {
      this.onSpeakerDetected({
        speaker: speaker,
        isUserSpeaking: this.micActive,
        volume: normalizedLevel,
        timestamp: Date.now(),
        stateChanged: this.micActive !== wasMicActive
      });
    }
  }

  // Start microphone capture after AssemblyAI session begins
  async startMicrophoneCapture() {
    console.log('Starting microphone capture...');
    
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });
      
      this.micStream = stream;
      
      // Create audio context if not exists
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 16000
        });
      }
      
      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // Set up audio processing pipeline
      const micSource = this.audioContext.createMediaStreamSource(stream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      
      micSource.connect(analyser);
      
      // Create processor node for collecting audio data
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (!this.isProcessing) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        const audioData = new Float32Array(inputData);
        this.audioBuffers.push(audioData);
      };
      
      analyser.connect(processor);
      processor.connect(this.audioContext.destination);
      
      // Start audio buffer processing (send every 250ms)
      this.bufferInterval = setInterval(() => this.processAudioBuffers(), 250);
      
      // Start speaker detection
      this.speakerDetectionThrottle = setInterval(() => {
        this.detectSpeaker(analyser);
      }, 100);
      
      console.log('✅ Microphone capture started');
      
    } catch (error) {
      console.error('❌ Failed to start microphone capture:', error);
      throw error;
    }
  }

  // Get current transcript state
  getTranscripts() {
    return this.transcripts;
  }
  
  // Export transcripts to JSON
  exportTranscripts() {
    return JSON.stringify({
      transcripts: this.transcripts,
      timestamp: Date.now()
    });
  }
}

export default AudioProcessor;
