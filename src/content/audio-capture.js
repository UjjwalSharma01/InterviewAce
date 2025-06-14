// Audio capture module for real-time transcription
class AudioCapture {
  constructor() {
    this.isCapturing = false;
    this.micStream = null;
    this.audioContext = null;
    this.onAudioData = null;
    this.onSpeakerDetected = null;
    this.micActive = false;
    this.audioBuffers = [];
    this.processInterval = null;
    this.speakerInterval = null;
  }
  
  // Initialize audio capture
  async initialize() {
    try {
      // Don't create AudioContext until user gesture
      return true;
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      return false;
    }
  }
  
  // Start audio capture
  async startCapture(onAudioData, onSpeakerDetected) {
    if (this.isCapturing) {
      throw new Error('Audio capture already started');
    }
    
    // Create AudioContext on user gesture (when start recording is clicked)
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });
    }
    
    // Resume AudioContext if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    this.onAudioData = onAudioData;
    this.onSpeakerDetected = onSpeakerDetected;
    
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
      this.isCapturing = true;
      
      // Create source from microphone
      const micSource = this.audioContext.createMediaStreamSource(stream);
      
      // Create analyzer for speaker detection
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      micSource.connect(analyser);
      
      // Create processor node for collecting audio data
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (!this.isCapturing) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        const audioData = new Float32Array(inputData);
        this.audioBuffers.push(audioData);
      };
      
      analyser.connect(processor);
      processor.connect(this.audioContext.destination);
      
      // Process audio buffers every 250ms
      this.processInterval = setInterval(() => {
        this.processAudioBuffers();
      }, 250);
      
      // Speaker detection every 100ms
      this.speakerInterval = setInterval(() => {
        this.detectSpeaker(analyser);
      }, 100);
      
      return true;
    } catch (error) {
      console.error('Failed to start audio capture:', error);
      this.isCapturing = false;
      throw error;
    }
  }
  
  // Stop audio capture
  stopCapture() {
    if (!this.isCapturing) return false;
    
    // Clear intervals
    clearInterval(this.processInterval);
    clearInterval(this.speakerInterval);
    
    // Stop microphone stream
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    
    // Reset state
    this.isCapturing = false;
    this.audioBuffers = [];
    
    return true;
  }
  
  // Process and send audio buffers
  processAudioBuffers() {
    if (!this.isCapturing || !this.onAudioData) return;
    
    if (this.audioBuffers.length === 0) return;
    
    // Concatenate all buffers
    let allSamples = [];
    for (const buffer of this.audioBuffers) {
      allSamples = allSamples.concat(Array.from(buffer));
    }
    
    // Clear buffers
    this.audioBuffers = [];
    
    // Convert to 16-bit PCM
    const pcmData = new Int16Array(allSamples.length);
    for (let i = 0; i < allSamples.length; i++) {
      pcmData[i] = Math.min(1, Math.max(-1, allSamples[i])) * 32767;
    }
    
    // Call callback with audio data
    this.onAudioData(pcmData.buffer);
  }
  
  // Detect speaker using audio levels
  detectSpeaker(analyser) {
    if (!this.isCapturing || !analyser || !this.onSpeakerDetected) return;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate average level
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    
    const average = sum / dataArray.length;
    const normalizedLevel = average / 255; // Normalize to 0-1 range
    
    // Improved speaker detection with lower threshold for user speech
    const wasMicActive = this.micActive;
    this.micActive = normalizedLevel > 0.15; // Lowered threshold for better sensitivity
    
    // Determine speaker based on audio level and mic state
    let speaker = "unknown";
    if (this.micActive) {
      speaker = "user"; // If mic is active and there's audio, it's the user
    } else if (normalizedLevel > 0.1) {
      speaker = "interviewer"; // If there's audio but mic isn't active, it's the interviewer
    }
    
    // Call callback with speaker info and state change
    this.onSpeakerDetected({
      speaker: speaker,
      isUserSpeaking: this.micActive,
      volume: normalizedLevel,
      timestamp: Date.now(),
      stateChanged: this.micActive !== wasMicActive
    });
  }
}

// Helper function to detect speaker (improved)
function detectSpeaker(micActive, audioLevel, source) {
  // More sensitive detection for user speech
  if (micActive && audioLevel > 0.15) return "user";
  if (!micActive && audioLevel > 0.1) return "interviewer";
  return "unknown";
}

export default AudioCapture;
