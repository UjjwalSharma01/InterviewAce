// Floating window implementation for real-time interview assistance
import AudioCapture from './audio-capture.js';

class FloatingWindow {
  constructor() {
    // State
    this.state = {
      isVisible: true,
      isRecording: false,
      isPaused: false,
      isScreenSharing: false,
      currentQuestion: null,
      questions: [],
      responses: {},
      activeProvider: 'openai',
      fontSize: {
        questions: 16,
        responses: 16
      },
      darkMode: true,
      lowContrast: false,
      windowPosition: { x: 20, y: 20 },
      windowSize: { width: 400, height: 500 }
    };
    
    // DOM elements
    this.windowElement = null;
    this.questionsList = null;
    this.responseArea = null;
    this.headerElement = null;
    
    // Audio capture
    this.audioCapture = new AudioCapture();
    
    // Transcription state
    this.currentTranscript = '';
    this.pendingQuestion = null;
    this.pendingQuestionTimeout = null;
    
    // Handlers
    this.onTranscriptUpdate = this.handleTranscriptUpdate.bind(this);
    this.onSpeakerDetected = this.handleSpeakerDetected.bind(this);
  }
  
  // Initialize the floating window
  async initialize() {
    console.log('Initializing floating window...');
    
    // Load settings from storage
    await this.loadSettings();
    
    // Create window DOM element
    this.createWindowElement();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Initialize audio capture
    await this.audioCapture.initialize();
    
    // Screen sharing detection
    this.detectScreenSharing();
    
    // Keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    return this;
  }
  
  // Load settings from Chrome storage
  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get([
        'fontSize',
        'darkMode',
        'lowContrast',
        'windowPosition',
        'windowSize',
        'activeProvider'
      ], (result) => {
        if (result.fontSize) this.state.fontSize = result.fontSize;
        if (result.darkMode !== undefined) this.state.darkMode = result.darkMode;
        if (result.lowContrast !== undefined) this.state.lowContrast = result.lowContrast;
        if (result.windowPosition) this.state.windowPosition = result.windowPosition;
        if (result.windowSize) this.state.windowSize = result.windowSize;
        if (result.activeProvider) this.state.activeProvider = result.activeProvider;
        resolve();
      });
    });
  }
  
  // Create window DOM element
  createWindowElement() {
    // Create container
    this.windowElement = document.createElement('div');
    this.windowElement.id = 'interview-buddy-window';
    this.windowElement.className = this.state.darkMode ? 'dark-mode' : 'light-mode';
    if (this.state.lowContrast) this.windowElement.classList.add('low-contrast');
    
    // Set initial position and size
    this.windowElement.style.left = `${this.state.windowPosition.x}px`;
    this.windowElement.style.top = `${this.state.windowPosition.y}px`;
    this.windowElement.style.width = `${this.state.windowSize.width}px`;
    this.windowElement.style.height = `${this.state.windowSize.height}px`;
    
    // Build window structure
    this.windowElement.innerHTML = `
      <div id="interview-buddy-header">
        <div class="drag-handle"></div>
        <div class="header-title">Interview Buddy</div>
        <div class="header-controls">
          <button id="interview-buddy-record" title="Start/Stop Recording">
            <span class="record-icon">⏺</span>
          </button>
          <button id="interview-buddy-settings" title="Settings">
            <span class="settings-icon">⚙️</span>
          </button>
          <button id="interview-buddy-minimize" title="Minimize">
            <span class="minimize-icon">_</span>
          </button>
        </div>
      </div>
      <div id="interview-buddy-content">
        <div id="interview-buddy-sidebar">
          <div id="interview-buddy-questions-list"></div>
          <div id="interview-buddy-sidebar-controls">
            <button id="interview-buddy-clear" title="Clear Context">
              <span class="clear-icon">🗑️</span> Clear
            </button>
            <button id="interview-buddy-export" title="Export Conversation">
              <span class="export-icon">📤</span> Export
            </button>
          </div>
        </div>
        <div id="interview-buddy-main">
          <div id="interview-buddy-response-area"></div>
          <div id="interview-buddy-provider-badge"></div>
          <div id="interview-buddy-controls">
            <button id="interview-buddy-regenerate" title="Regenerate Response">
              <span class="regenerate-icon">🔄</span> Regenerate
            </button>
            <div id="interview-buddy-providers-dropdown" class="dropdown">
              <button class="dropdown-toggle">
                <span id="current-provider-name">OpenAI</span> <span class="dropdown-arrow">▼</span>
              </button>
              <div class="dropdown-menu">
                <a href="#" data-provider="openai">OpenAI GPT-4</a>
                <a href="#" data-provider="anthropic">Claude 3.5</a>
                <a href="#" data-provider="gemini">Gemini Pro</a>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="resize-handle resize-handle-se"></div>
    `;
    
    // Add to DOM
    document.body.appendChild(this.windowElement);
    
    // Get references to important elements
    this.headerElement = document.getElementById('interview-buddy-header');
    this.questionsList = document.getElementById('interview-buddy-questions-list');
    this.responseArea = document.getElementById('interview-buddy-response-area');
    
    // Update provider badge
    this.updateProviderBadge(this.state.activeProvider);
    
    // Update font sizes
    this.updateFontSizes();
  }
  
  // Setup event listeners
  setupEventListeners() {
    // Record button
    document.getElementById('interview-buddy-record').addEventListener('click', 
      () => this.toggleRecording());
    
    // Settings button
    document.getElementById('interview-buddy-settings').addEventListener('click', 
      () => this.openSettings());
    
    // Minimize button
    document.getElementById('interview-buddy-minimize').addEventListener('click', 
      () => this.toggleVisibility());
    
    // Clear button
    document.getElementById('interview-buddy-clear').addEventListener('click', 
      () => this.clearContext());
    
    // Export button
    document.getElementById('interview-buddy-export').addEventListener('click', 
      () => this.exportConversation());
    
    // Regenerate button
    document.getElementById('interview-buddy-regenerate').addEventListener('click', 
      () => this.regenerateResponse());
    
    // Provider dropdown
    document.querySelector('.dropdown-toggle').addEventListener('click', 
      () => this.toggleProviderDropdown());
    
    // Provider selection
    document.querySelectorAll('#interview-buddy-providers-dropdown .dropdown-menu a').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const provider = e.target.dataset.provider;
        this.changeProvider(provider);
        this.hideProviderDropdown();
      });
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#interview-buddy-providers-dropdown')) {
        this.hideProviderDropdown();
      }
    });
    
    // Pause streaming when hovering
    this.responseArea.addEventListener('mouseenter', () => {
      this.state.isPaused = true;
    });
    
    this.responseArea.addEventListener('mouseleave', () => {
      this.state.isPaused = false;
    });
    
    // Make window draggable
    this.makeDraggable();
    
    // Make window resizable
    this.makeResizable();
  }
  
  // Make the window draggable
  makeDraggable() {
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    this.headerElement.addEventListener('mousedown', (e) => {
      // Only allow dragging from header or drag handle
      if (e.target.closest('.drag-handle') || e.target === this.headerElement || e.target.closest('.header-title')) {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseInt(this.windowElement.style.left) || 0;
        startTop = parseInt(this.windowElement.style.top) || 0;
        e.preventDefault();
      }
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const newLeft = startLeft + (e.clientX - startX);
      const newTop = startTop + (e.clientY - startY);
      
      // Apply new position
      this.windowElement.style.left = `${newLeft}px`;
      this.windowElement.style.top = `${newTop}px`;
      
      // Save position to state
      this.state.windowPosition = { x: newLeft, y: newTop };
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        
        // Save position to storage
        chrome.storage.local.set({ windowPosition: this.state.windowPosition });
      }
    });
  }
  
  // Make the window resizable
  makeResizable() {
    const resizeHandle = this.windowElement.querySelector('.resize-handle-se');
    let isResizing = false;
    let startX, startY, startWidth, startHeight;
    
    resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = parseInt(this.windowElement.style.width) || this.state.windowSize.width;
      startHeight = parseInt(this.windowElement.style.height) || this.state.windowSize.height;
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      
      const newWidth = Math.max(300, startWidth + (e.clientX - startX));
      const newHeight = Math.max(200, startHeight + (e.clientY - startY));
      
      // Apply new size
      this.windowElement.style.width = `${newWidth}px`;
      this.windowElement.style.height = `${newHeight}px`;
      
      // Save size to state
      this.state.windowSize = { width: newWidth, height: newHeight };
    });
    
    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        
        // Save size to storage
        chrome.storage.local.set({ windowSize: this.state.windowSize });
      }
    });
  }
  
  // Toggle recording
  toggleRecording() {
    if (this.state.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }
  
  // Start recording and transcription
  async startRecording() {
    try {
      // Start audio capture
      await this.audioCapture.startCapture(
        this.handleAudioData.bind(this),
        this.onSpeakerDetected
      );
      
      this.state.isRecording = true;
      
      // Update button appearance
      const recordButton = document.getElementById('interview-buddy-record');
      recordButton.classList.add('recording');
      
      // Add first question placeholder if needed
      if (this.state.questions.length === 0) {
        this.addNewQuestion('Waiting for question...');
      }
      
      // Send message to background script
      chrome.runtime.sendMessage({ 
        type: 'START_TRANSCRIPTION'
      });
      
      this.showNotification('Recording started', 'success');
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.showNotification('Failed to start recording: ' + error.message, 'error');
    }
  }
  
  // Stop recording and transcription
  stopRecording() {
    try {
      // Stop audio capture
      this.audioCapture.stopCapture();
      
      this.state.isRecording = false;
      
      // Update button appearance
      const recordButton = document.getElementById('interview-buddy-record');
      recordButton.classList.remove('recording');
      
      // Send message to background script
      chrome.runtime.sendMessage({ 
        type: 'STOP_TRANSCRIPTION'
      });
      
      this.showNotification('Recording stopped', 'success');
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.showNotification('Failed to stop recording: ' + error.message, 'error');
    }
  }
  
  // Handle audio data
  handleAudioData(audioBuffer) {
    // In a real implementation, this would be sent to AssemblyAI
    // via the background script
    chrome.runtime.sendMessage({
      type: 'PROCESS_AUDIO',
      audioBuffer: Array.from(new Uint8Array(audioBuffer))
    });
  }
  
  // Handle transcript update from AssemblyAI
  handleTranscriptUpdate(transcript, allTranscripts) {
    if (!transcript || !transcript.text) return;
    
    // Store current transcript
    this.currentTranscript = transcript.text;
    
    // If this is a final transcript and it looks like a question
    if (transcript.isFinal && this.isLikelyQuestion(transcript.text)) {
      // Clear any pending question timeout
      if (this.pendingQuestionTimeout) {
        clearTimeout(this.pendingQuestionTimeout);
      }
      
      // Create new question
      this.pendingQuestion = transcript.text;
      
      // Wait a bit to see if there's more to the question
      this.pendingQuestionTimeout = setTimeout(() => {
        if (this.pendingQuestion) {
          this.createNewQuestionFromTranscript(this.pendingQuestion);
          this.pendingQuestion = null;
        }
      }, 2000);
    }
  }
  
  // Handle speaker detection
  handleSpeakerDetected(speaker, audioLevel) {
    // Update UI based on who is speaking
    if (speaker === 'interviewer' && audioLevel > 0.3) {
      // Interviewer is speaking loudly, might be asking a question
      // No action needed yet, we'll wait for the transcript
    }
  }
  
  // Check if text is likely a question
  isLikelyQuestion(text) {
    // Simple heuristic - ends with question mark or starts with common question words
    if (text.trim().endsWith('?')) return true;
    
    const questionStarters = [
      'what', 'how', 'why', 'when', 'where', 'who', 'which', 'can you', 
      'could you', 'tell me', 'explain', 'describe'
    ];
    
    const lowerText = text.toLowerCase();
    return questionStarters.some(starter => lowerText.startsWith(starter));
  }
  
  // Create new question from transcript
  createNewQuestionFromTranscript(text) {
    // Update the placeholder question or create a new one
    if (this.state.questions.length === 1 && 
        this.state.questions[0].text === 'Waiting for question...') {
      // Update the placeholder
      this.updateQuestion(this.state.questions[0].id, text);
    } else {
      // Create a new question
      this.addNewQuestion(text);
    }
  }
  
  // Open settings panel
  openSettings() {
    chrome.runtime.sendMessage({ type: 'OPEN_SETTINGS' });
  }
  
  // Toggle window visibility
  toggleVisibility() {
    if (this.state.isVisible) {
      this.windowElement.classList.add('minimized');
    } else {
      this.windowElement.classList.remove('minimized');
    }
    
    this.state.isVisible = !this.state.isVisible;
  }
  
  // Clear context
  clearContext() {
    // Show confirmation dialog
    if (confirm('Are you sure you want to clear all questions and responses?')) {
      chrome.runtime.sendMessage({ type: 'CLEAR_CONTEXT' }, () => {
        // Clear local state
        this.state.questions = [];
        this.state.responses = {};
        this.state.currentQuestion = null;
        
        // Clear UI
        this.questionsList.innerHTML = '';
        this.responseArea.innerHTML = '';
        
        this.showNotification('Context cleared', 'success');
      });
    }
  }
  
  // Export conversation
  exportConversation() {
    const conversation = {
      questions: this.state.questions,
      responses: this.state.responses,
      timestamp: Date.now()
    };
    
    // Create download link
    const dataStr = "data:text/json;charset=utf-8," + 
      encodeURIComponent(JSON.stringify(conversation, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", 
      `interview-buddy-export-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }
  
  // Regenerate response
  regenerateResponse() {
    if (!this.state.currentQuestion) return;
    
    const questionId = this.state.currentQuestion;
    const questionText = this.state.questions.find(q => q.id === questionId)?.text;
    
    if (!questionText) return;
    
    // Clear current response
    this.responseArea.innerHTML = `<div class="loading-indicator">Regenerating response...</div>`;
    
    // Request regeneration
    chrome.runtime.sendMessage({
      type: 'REGENERATE_RESPONSE',
      questionId,
      provider: this.state.activeProvider
    }, (response) => {
      if (response && response.success) {
        // Update state
        this.state.responses[questionId] = {
          text: response.response,
          provider: response.provider,
          timestamp: Date.now()
        };
        
        // Update UI
        this.displayResponse(questionId);
      } else {
        console.error('Failed to regenerate response:', response?.error);
        this.responseArea.innerHTML = `<div class="error-message">Failed to regenerate: ${response?.error || 'Unknown error'}</div>`;
      }
    });
  }
  
  // Toggle provider dropdown
  toggleProviderDropdown() {
    const dropdown = document.querySelector('#interview-buddy-providers-dropdown .dropdown-menu');
    dropdown.classList.toggle('show');
  }
  
  // Hide provider dropdown
  hideProviderDropdown() {
    const dropdown = document.querySelector('#interview-buddy-providers-dropdown .dropdown-menu');
    dropdown.classList.remove('show');
  }
  
  // Change AI provider
  changeProvider(provider) {
    chrome.runtime.sendMessage({ 
      type: 'CHANGE_PROVIDER', 
      provider 
    }, (response) => {
      if (response && response.success) {
        this.state.activeProvider = provider;
        this.updateProviderBadge(provider);
        
        // Update dropdown text
        const providerNames = {
          openai: 'OpenAI GPT-4',
          anthropic: 'Claude 3.5',
          gemini: 'Gemini Pro'
        };
        
        document.getElementById('current-provider-name').textContent = 
          providerNames[provider] || 'Unknown Provider';
      }
    });
  }
  
  // Update provider badge
  updateProviderBadge(provider) {
    const badge = document.getElementById('interview-buddy-provider-badge');
    
    const providerLabels = {
      openai: 'OpenAI GPT-4',
      anthropic: 'Claude 3.5',
      gemini: 'Gemini Pro'
    };
    
    badge.textContent = providerLabels[provider] || 'AI Assistant';
    
    // Update badge class
    badge.className = 'provider-badge';
    badge.classList.add(`provider-${provider}`);
  }
  
  // Update font sizes
  updateFontSizes() {
    const questionElements = this.questionsList.querySelectorAll('.question-item');
    questionElements.forEach(el => {
      el.style.fontSize = `${this.state.fontSize.questions}px`;
    });
    
    this.responseArea.style.fontSize = `${this.state.fontSize.responses}px`;
  }
  
  // Add a new question
  addNewQuestion(text, id = null) {
    const questionId = id || Date.now().toString();
    
    // Add to state
    this.state.questions.push({
      id: questionId,
      text: text,
      timestamp: Date.now()
    });
    
    // Create question element
    const questionElement = document.createElement('div');
    questionElement.className = 'question-item';
    questionElement.dataset.id = questionId;
    questionElement.innerHTML = `
      <div class="question-number">Q${this.state.questions.length}</div>
      <div class="question-text">${text}</div>
    `;
    
    // Add click handler
    questionElement.addEventListener('click', () => {
      this.selectQuestion(questionId);
    });
    
    // Add to questions list
    this.questionsList.appendChild(questionElement);
    
    // Select this question
    this.selectQuestion(questionId);
    
    return questionId;
  }
  
  // Update an existing question
  updateQuestion(questionId, text) {
    // Update in state
    const questionIndex = this.state.questions.findIndex(q => q.id === questionId);
    if (questionIndex === -1) return;
    
    this.state.questions[questionIndex].text = text;
    
    // Update in UI
    const questionElement = this.questionsList.querySelector(`.question-item[data-id="${questionId}"]`);
    if (questionElement) {
      questionElement.querySelector('.question-text').textContent = text;
    }
    
    // If this is the current question, generate a response
    if (this.state.currentQuestion === questionId && text !== 'Waiting for question...') {
      this.generateResponse(questionId, text);
    }
  }
  
  // Select a question
  selectQuestion(questionId) {
    // Update UI
    const questionElements = this.questionsList.querySelectorAll('.question-item');
    questionElements.forEach(el => {
      el.classList.remove('selected');
      if (el.dataset.id === questionId) {
        el.classList.add('selected');
      }
    });
    
    // Update state
    this.state.currentQuestion = questionId;
    
    // Display response if exists
    if (this.state.responses[questionId]) {
      this.displayResponse(questionId);
    } else {
      // Otherwise show loading or generate new response
      const question = this.state.questions.find(q => q.id === questionId);
      if (question && question.text !== 'Waiting for question...') {
        this.generateResponse(questionId, question.text);
      } else {
        this.responseArea.innerHTML = '<div class="waiting-message">Waiting for question to be transcribed...</div>';
      }
    }
  }
  
  // Generate AI response
  generateResponse(questionId, text) {
    // Show loading indicator
    this.responseArea.innerHTML = '<div class="loading-indicator">Generating response...</div>';
    
    // Request AI response
    chrome.runtime.sendMessage({
      type: 'GENERATE_AI_RESPONSE',
      questionId,
      text
    }, (response) => {
      if (response && response.success) {
        // Update state
        this.state.responses[questionId] = {
          text: response.response,
          provider: response.provider,
          timestamp: Date.now()
        };
        
        // Update UI
        this.displayResponse(questionId);
      } else {
        console.error('Failed to generate response:', response?.error);
        this.responseArea.innerHTML = `<div class="error-message">Failed to generate response: ${response?.error || 'Unknown error'}</div>`;
      }
    });
  }
  
  // Display response
  displayResponse(questionId) {
    const response = this.state.responses[questionId];
    if (!response) return;
    
    // Format response
    const formattedText = this.formatResponseText(response.text);
    
    // Update provider badge
    this.updateProviderBadge(response.provider);
    
    // Display response
    this.responseArea.innerHTML = `
      <div class="response-text">${formattedText}</div>
      <div class="response-timestamp">Generated at ${new Date(response.timestamp).toLocaleTimeString()}</div>
    `;
  }
  
  // Format response text
  formatResponseText(text) {
    // Replace newlines with <br>
    return text.replace(/\n/g, '<br>');
  }
  
  // Show notification
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }
  
  // Detect screen sharing
  detectScreenSharing() {
    // Check every 5 seconds
    setInterval(() => {
      chrome.runtime.sendMessage({ type: 'CHECK_SCREEN_SHARING' }, (response) => {
        if (response) {
          const wasSharing = this.state.isScreenSharing;
          this.state.isScreenSharing = response.isScreenSharing;
          
          // If screen sharing state changed
          if (wasSharing !== this.state.isScreenSharing) {
            if (this.state.isScreenSharing) {
              // Hide window when screen sharing starts
              this.windowElement.classList.add('hidden');
            } else {
              // Show window when screen sharing stops
              this.windowElement.classList.remove('hidden');
            }
          }
        }
      });
    }, 5000);
  }
  
  // Setup keyboard shortcuts
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+H: Toggle visibility
      if (e.ctrlKey && e.shiftKey && e.key === 'H') {
        this.toggleVisibility();
        e.preventDefault();
      }
      
      // Ctrl+Shift+C: Clear context
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        this.clearContext();
        e.preventDefault();
      }
      
      // Ctrl+Shift+R: Regenerate response
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        this.regenerateResponse();
        e.preventDefault();
      }
      
      // Escape: Pause/resume transcription
      if (e.key === 'Escape' && this.state.isRecording) {
        this.toggleRecording();
        e.preventDefault();
      }
    });
  }
}

export default FloatingWindow;
