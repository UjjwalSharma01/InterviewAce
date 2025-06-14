// Simplified audio processor that delegates to content script
class AudioProcessor {
  constructor() {
    this.isProcessing = false;
    this.sessionId = null;
    this.onTranscriptUpdate = null;
  }
  
  // Start transcription by delegating to content script
  async startTranscription(assemblyaiApiKey, sessionId, onTranscriptCallback) {
    console.log('Starting transcription via content script...');
    
    if (this.isProcessing) {
      console.log('Transcription already in progress');
      return false;
    }
    
    if (!assemblyaiApiKey || assemblyaiApiKey === 'your-assemblyai-key-here') {
      console.error('Valid AssemblyAI API key is required');
      return false;
    }
    
    this.sessionId = sessionId;
    this.onTranscriptUpdate = onTranscriptCallback;
    this.isProcessing = true;
    
    try {
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error('No active tab found');
      }
      
      // Send message to content script to start audio capture
      chrome.tabs.sendMessage(tab.id, {
        type: 'START_AUDIO_CAPTURE',
        apiKey: assemblyaiApiKey,
        sessionId: sessionId
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to communicate with content script:', chrome.runtime.lastError);
          this.isProcessing = false;
        } else if (response && response.success) {
          console.log('✅ Audio capture started in content script');
        } else {
          console.error('❌ Content script failed to start audio capture');
          this.isProcessing = false;
        }
      });
      
      return true;
    } catch (error) {
      console.error('❌ Failed to start transcription:', error);
      this.isProcessing = false;
      return false;
    }
  }
  
  // Stop transcription
  stopTranscription() {
    console.log('Stopping transcription...');
    
    if (!this.isProcessing) {
      return false;
    }
    
    // Send message to content script to stop audio capture
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'STOP_AUDIO_CAPTURE'
        });
      }
    });
    
    this.isProcessing = false;
    console.log('✅ Transcription stopped');
    return true;
  }
  
  // Handle transcript received from content script
  handleTranscriptFromContent(transcript, speaker) {
    if (this.onTranscriptUpdate) {
      this.onTranscriptUpdate(transcript, speaker);
    }
  }
}

export default AudioProcessor;
