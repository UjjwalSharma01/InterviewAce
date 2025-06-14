// Content script for injecting the floating window into video call platforms
(() => {
  // State management
  let state = {
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
  let floatingWindow = null;
  let questionsList = null;
  let responseArea = null;
  let headerElement = null;
  
  // Initialize the extension
  function initialize() {
    console.log('Interview Buddy: Initializing...');
    
    // Load settings from storage
    chrome.storage.local.get([
      'fontSize',
      'darkMode',
      'lowContrast',
      'windowPosition',
      'windowSize',
      'activeProvider'
    ], (result) => {
      if (result.fontSize) state.fontSize = result.fontSize;
      if (result.darkMode !== undefined) state.darkMode = result.darkMode;
      if (result.lowContrast !== undefined) state.lowContrast = result.lowContrast;
      if (result.windowPosition) state.windowPosition = result.windowPosition;
      if (result.windowSize) state.windowSize = result.windowSize;
      if (result.activeProvider) state.activeProvider = result.activeProvider;
      else state.activeProvider = 'gemini'; // Default to Gemini 2.5 Flash
      
      // Create floating window
      createFloatingWindow();
      
      // Setup screen sharing detection
      detectScreenSharing();
      
      // Setup keyboard shortcuts
      setupKeyboardShortcuts();
      
      // Setup message listener for transcripts
      setupMessageListener();
    });
  }
  
  // Create the floating window
  function createFloatingWindow() {
    // Create container
    floatingWindow = document.createElement('div');
    floatingWindow.id = 'interview-buddy-window';
    floatingWindow.className = state.darkMode ? 'dark-mode' : 'light-mode';
    if (state.lowContrast) floatingWindow.classList.add('low-contrast');
    
    // Set initial position and size
    floatingWindow.style.left = `${state.windowPosition.x}px`;
    floatingWindow.style.top = `${state.windowPosition.y}px`;
    floatingWindow.style.width = `${state.windowSize.width}px`;
    floatingWindow.style.height = `${state.windowSize.height}px`;
    
    // Build window structure
    floatingWindow.innerHTML = `
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
                <span id="current-provider-name">Gemini 2.5 Flash</span> <span class="dropdown-arrow">▼</span>
              </button>
              <div class="dropdown-menu">
                <a href="#" data-provider="gemini">Gemini 2.5 Flash</a>
                <a href="#" data-provider="openai">OpenAI GPT-4</a>
                <a href="#" data-provider="anthropic">Claude 3.5</a>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="resize-handle resize-handle-se"></div>
    `;
    
    // Add to DOM
    document.body.appendChild(floatingWindow);
    
    // Get references to important elements
    headerElement = document.getElementById('interview-buddy-header');
    questionsList = document.getElementById('interview-buddy-questions-list');
    responseArea = document.getElementById('interview-buddy-response-area');
    
    // Setup event listeners
    setupEventListeners();
    
    // Make window draggable
    makeDraggable();
    
    // Make window resizable
    makeResizable();
    
    // Update provider badge
    updateProviderBadge(state.activeProvider);
    
    // Update font sizes
    updateFontSizes();
  }
  
  // Set up event listeners for the floating window
  function setupEventListeners() {
    // Record button
    document.getElementById('interview-buddy-record').addEventListener('click', toggleRecording);
    
    // Settings button
    document.getElementById('interview-buddy-settings').addEventListener('click', openSettings);
    
    // Minimize button
    document.getElementById('interview-buddy-minimize').addEventListener('click', toggleVisibility);
    
    // Clear button
    document.getElementById('interview-buddy-clear').addEventListener('click', clearContext);
    
    // Export button
    document.getElementById('interview-buddy-export').addEventListener('click', exportConversation);
    
    // Regenerate button
    document.getElementById('interview-buddy-regenerate').addEventListener('click', regenerateResponse);
    
    // Provider dropdown
    document.querySelector('.dropdown-toggle').addEventListener('click', toggleProviderDropdown);
    
    // Provider selection
    document.querySelectorAll('#interview-buddy-providers-dropdown .dropdown-menu a').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const provider = e.target.dataset.provider;
        changeProvider(provider);
        hideProviderDropdown();
      });
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#interview-buddy-providers-dropdown')) {
        hideProviderDropdown();
      }
    });
    
    // Pause streaming when hovering
    responseArea.addEventListener('mouseenter', () => {
      state.isPaused = true;
    });
    
    responseArea.addEventListener('mouseleave', () => {
      state.isPaused = false;
    });
  }
  
  // Make the window draggable
  function makeDraggable() {
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    headerElement.addEventListener('mousedown', (e) => {
      // Only allow dragging from header or drag handle
      if (e.target.closest('.drag-handle') || e.target === headerElement || e.target.closest('.header-title')) {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseInt(floatingWindow.style.left) || 0;
        startTop = parseInt(floatingWindow.style.top) || 0;
        e.preventDefault();
      }
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const newLeft = startLeft + (e.clientX - startX);
      const newTop = startTop + (e.clientY - startY);
      
      // Apply new position
      floatingWindow.style.left = `${newLeft}px`;
      floatingWindow.style.top = `${newTop}px`;
      
      // Save position to state
      state.windowPosition = { x: newLeft, y: newTop };
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        
        // Save position to storage
        chrome.storage.local.set({ windowPosition: state.windowPosition });
      }
    });
  }
  
  // Make the window resizable
  function makeResizable() {
    const resizeHandle = floatingWindow.querySelector('.resize-handle-se');
    let isResizing = false;
    let startX, startY, startWidth, startHeight;
    
    resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = parseInt(floatingWindow.style.width) || state.windowSize.width;
      startHeight = parseInt(floatingWindow.style.height) || state.windowSize.height;
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      
      const newWidth = Math.max(300, startWidth + (e.clientX - startX));
      const newHeight = Math.max(200, startHeight + (e.clientY - startY));
      
      // Apply new size
      floatingWindow.style.width = `${newWidth}px`;
      floatingWindow.style.height = `${newHeight}px`;
      
      // Save size to state
      state.windowSize = { width: newWidth, height: newHeight };
    });
    
    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        
        // Save size to storage
        chrome.storage.local.set({ windowSize: state.windowSize });
      }
    });
  }
  
  // Toggle recording
  function toggleRecording() {
    if (state.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }
  
  // Start recording
  function startRecording() {
    console.log('Starting recording...');
    chrome.runtime.sendMessage({ type: 'START_TRANSCRIPTION' }, (response) => {
      if (response && response.success) {
        state.isRecording = true;
        
        // Update button appearance
        const recordButton = document.getElementById('interview-buddy-record');
        recordButton.classList.add('recording');
        
        // Add first question placeholder
        if (state.questions.length === 0) {
          addNewQuestion('Waiting for question...');
        }
        
        console.log('Recording started successfully');
        showNotification('Recording started', 'success');
      } else {
        console.error('Failed to start recording:', response?.error || 'Unknown error');
        
        if (response?.error && response.error.includes('API key')) {
          showNotification('Please configure API keys in settings', 'error');
          // Open settings after delay
          setTimeout(() => openSettings(), 1000);
        } else {
          showNotification('Failed to start recording: ' + (response?.error || 'Unknown error'), 'error');
        }
      }
    });
  }
  
  // Stop recording
  function stopRecording() {
    chrome.runtime.sendMessage({ type: 'STOP_TRANSCRIPTION' }, (response) => {
      if (response.success) {
        state.isRecording = false;
        
        // Update button appearance
        const recordButton = document.getElementById('interview-buddy-record');
        recordButton.classList.remove('recording');
      } else {
        console.error('Failed to stop recording:', response.error);
        showNotification('Failed to stop recording: ' + response.error, 'error');
      }
    });
  }
  
  // Open settings panel
  function openSettings() {
    chrome.runtime.sendMessage({ type: 'OPEN_SETTINGS' });
  }
  
  // Toggle window visibility
  function toggleVisibility() {
    if (state.isVisible) {
      floatingWindow.classList.add('minimized');
    } else {
      floatingWindow.classList.remove('minimized');
    }
    
    state.isVisible = !state.isVisible;
  }
  
  // Clear context
  function clearContext() {
    // Show confirmation dialog
    if (confirm('Are you sure you want to clear all questions and responses?')) {
      chrome.runtime.sendMessage({ type: 'CLEAR_CONTEXT' }, (response) => {
        if (response.success) {
          // Clear local state
          state.questions = [];
          state.responses = {};
          state.currentQuestion = null;
          
          // Clear UI
          questionsList.innerHTML = '';
          responseArea.innerHTML = '';
          
          showNotification('Context cleared', 'success');
        }
      });
    }
  }
  
  // Export conversation
  function exportConversation() {
    const conversation = {
      questions: state.questions,
      responses: state.responses,
      timestamp: Date.now()
    };
    
    // Create download link
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(conversation, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `interview-buddy-export-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }
  
  // Regenerate response
  function regenerateResponse() {
    if (!state.currentQuestion) return;
    
    const questionId = state.currentQuestion;
    const questionText = state.questions.find(q => q.id === questionId)?.text;
    
    if (!questionText) return;
    
    // Clear current response
    responseArea.innerHTML = `<div class="loading-indicator">Regenerating response...</div>`;
    
    // Request regeneration
    chrome.runtime.sendMessage({
      type: 'REGENERATE_RESPONSE',
      questionId,
      provider: state.activeProvider
    }, (response) => {
      if (response.success) {
        // Update state
        state.responses[questionId] = {
          text: response.response,
          provider: response.provider,
          timestamp: Date.now()
        };
        
        // Update UI
        displayResponse(questionId);
      } else {
        console.error('Failed to regenerate response:', response.error);
        responseArea.innerHTML = `<div class="error-message">Failed to regenerate: ${response.error}</div>`;
      }
    });
  }
  
  // Toggle provider dropdown
  function toggleProviderDropdown() {
    const dropdown = document.querySelector('#interview-buddy-providers-dropdown .dropdown-menu');
    dropdown.classList.toggle('show');
  }
  
  // Hide provider dropdown
  function hideProviderDropdown() {
    const dropdown = document.querySelector('#interview-buddy-providers-dropdown .dropdown-menu');
    dropdown.classList.remove('show');
  }
  
  // Change AI provider
  function changeProvider(provider) {
    chrome.runtime.sendMessage({ 
      type: 'CHANGE_PROVIDER', 
      provider 
    }, (response) => {
      if (response.success) {
        state.activeProvider = provider;
        updateProviderBadge(provider);
        
        // Update dropdown text
        const providerNames = {
          openai: 'OpenAI GPT-4',
          anthropic: 'Claude 3.5',
          gemini: 'Gemini 2.5 Flash'
        };
        
        document.getElementById('current-provider-name').textContent = 
          providerNames[provider] || 'Unknown Provider';
      }
    });
  }
  
  // Update provider badge
  function updateProviderBadge(provider) {
    const badge = document.getElementById('interview-buddy-provider-badge');
    
    const providerLabels = {
      openai: 'OpenAI GPT-4',
      anthropic: 'Claude 3.5',
      gemini: 'Gemini 2.5 Flash'
    };
    
    badge.textContent = providerLabels[provider] || 'AI Assistant';
    
    // Update badge class
    badge.className = 'provider-badge';
    badge.classList.add(`provider-${provider}`);
  }
  
  // Update font sizes
  function updateFontSizes() {
    const questionElements = questionsList.querySelectorAll('.question-item');
    questionElements.forEach(el => {
      el.style.fontSize = `${state.fontSize.questions}px`;
    });
    
    responseArea.style.fontSize = `${state.fontSize.responses}px`;
  }
  
  // Add a new question
  function addNewQuestion(text, id = null) {
    const questionId = id || Date.now().toString();
    
    // Add to state
    state.questions.push({
      id: questionId,
      text: text,
      timestamp: Date.now()
    });
    
    // Create question element
    const questionElement = document.createElement('div');
    questionElement.className = 'question-item';
    questionElement.dataset.id = questionId;
    questionElement.innerHTML = `
      <div class="question-number">Q${state.questions.length}</div>
      <div class="question-text">${text}</div>
    `;
    
    // Add click handler
    questionElement.addEventListener('click', () => {
      selectQuestion(questionId);
    });
    
    // Add to questions list
    questionsList.appendChild(questionElement);
    
    // Select this question
    selectQuestion(questionId);
    
    return questionId;
  }
  
  // Select a question
  function selectQuestion(questionId) {
    // Update UI
    const questionElements = questionsList.querySelectorAll('.question-item');
    questionElements.forEach(el => {
      el.classList.remove('selected');
      if (el.dataset.id === questionId) {
        el.classList.add('selected');
      }
    });
    
    // Update state
    state.currentQuestion = questionId;
    
    // Display response if exists
    if (state.responses[questionId]) {
      displayResponse(questionId);
    } else {
      // Otherwise show loading or generate new response
      const question = state.questions.find(q => q.id === questionId);
      if (question && question.text !== 'Waiting for question...') {
        generateResponse(questionId, question.text);
      } else {
        responseArea.innerHTML = '<div class="waiting-message">Waiting for question to be transcribed...</div>';
      }
    }
  }
  
  // Generate AI response
  function generateResponse(questionId, text) {
    // Show loading indicator
    responseArea.innerHTML = '<div class="loading-indicator">Generating response...</div>';
    
    // Request AI response
    chrome.runtime.sendMessage({
      type: 'GENERATE_AI_RESPONSE',
      questionId,
      text
    }, (response) => {
      if (response.success) {
        // Update state
        state.responses[questionId] = {
          text: response.response,
          provider: response.provider,
          timestamp: Date.now()
        };
        
        // Update UI
        displayResponse(questionId);
      } else {
        console.error('Failed to generate response:', response.error);
        responseArea.innerHTML = `<div class="error-message">Failed to generate response: ${response.error}</div>`;
      }
    });
  }
  
  // Display response
  function displayResponse(questionId) {
    const response = state.responses[questionId];
    if (!response) return;
    
    // Format response
    const formattedText = formatResponseText(response.text);
    
    // Update provider badge
    updateProviderBadge(response.provider);
    
    // Display response
    responseArea.innerHTML = `
      <div class="response-text">${formattedText}</div>
      <div class="response-timestamp">Generated at ${new Date(response.timestamp).toLocaleTimeString()}</div>
    `;
  }
  
  // Format response text
  function formatResponseText(text) {
    // Replace newlines with <br>
    return text.replace(/\n/g, '<br>');
  }
  
  // Show notification
  function showNotification(message, type = 'info') {
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
  function detectScreenSharing() {
    // Check every 5 seconds
    setInterval(() => {
      chrome.runtime.sendMessage({ type: 'CHECK_SCREEN_SHARING' }, (response) => {
        const wasSharing = state.isScreenSharing;
        state.isScreenSharing = response.isScreenSharing;
        
        // If screen sharing state changed
        if (wasSharing !== state.isScreenSharing) {
          if (state.isScreenSharing) {
            // Hide window when screen sharing starts
            floatingWindow.classList.add('hidden');
          } else {
            // Show window when screen sharing stops
            floatingWindow.classList.remove('hidden');
          }
        }
      });
    }, 5000);
  }
  
  // Setup keyboard shortcuts
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+H: Toggle visibility
      if (e.ctrlKey && e.shiftKey && e.key === 'H') {
        toggleVisibility();
        e.preventDefault();
      }
      
      // Ctrl+Shift+C: Clear context
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        clearContext();
        e.preventDefault();
      }
      
      // Ctrl+Shift+R: Regenerate response
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        regenerateResponse();
        e.preventDefault();
      }
      
      // Escape: Pause/resume transcription
      if (e.key === 'Escape' && state.isRecording) {
        toggleRecording();
        e.preventDefault();
      }
    });
  }
  
  // Load CSS styles
  function loadStyles() {
    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = chrome.runtime.getURL('src/assets/styles/floating-window.css');
    document.head.appendChild(styleLink);
  }
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'AI_RESPONSE_CHUNK':
        handleAIResponseChunk(message);
        break;
      case 'TRANSCRIPTION_UPDATE':
        handleTranscriptionUpdate(message);
        break;
      case 'SPEAKER_DETECTED':
        handleSpeakerDetected(message);
        break;
    }
  });
  
  // Handle streaming AI response chunks
  function handleAIResponseChunk(message) {
    const { chunk, questionId, isComplete } = message;
    
    // Find the question element
    const questionElement = document.querySelector(`[data-question-id="${questionId}"]`);
    if (!questionElement) return;
    
    // Find or create response area
    let responseArea = questionElement.querySelector('.response-text');
    if (!responseArea) {
      const responseContainer = questionElement.querySelector('.response-container');
      if (!responseContainer) return;
      
      responseArea = document.createElement('div');
      responseArea.className = 'response-text';
      responseContainer.appendChild(responseArea);
    }
    
    if (!isComplete) {
      // Append chunk to response
      responseArea.textContent += chunk;
      
      // Auto-scroll to bottom
      responseArea.scrollTop = responseArea.scrollHeight;
    } else {
      // Response is complete, clean up any indicators
      const loadingIndicator = questionElement.querySelector('.loading-indicator');
      if (loadingIndicator) {
        loadingIndicator.remove();
      }
      
      // Mark as complete
      questionElement.classList.add('response-complete');
    }
  }
  
  // Handle transcription updates
  function handleTranscriptionUpdate(message) {
    const { transcript, isFinal } = message;
    
    if (isFinal && isLikelyQuestion(transcript)) {
      // Create new question
      addNewQuestion(transcript);
    }
  }
  
  // Handle speaker detection
  function handleSpeakerDetected(message) {
    const { speaker, isUserSpeaking, volume, stateChanged } = message;
    
    // Only update UI when there's a significant state change
    if (stateChanged) {
      console.log(`Speaker changed: ${speaker}, User speaking: ${isUserSpeaking}, Volume: ${volume.toFixed(2)}`);
      
      // Update UI based on who is speaking
      if (isUserSpeaking && volume > 0.2) {
        // User is speaking - show visual feedback
        updateSpeakerIndicator('user', volume);
        
        // Start transcription if not already started
        if (!state.isRecording) {
          startRecording();
        }
      } else if (speaker === 'interviewer' && volume > 0.15) {
        // Interviewer is speaking - prepare to capture question
        updateSpeakerIndicator('interviewer', volume);
      } else {
        // No one speaking
        updateSpeakerIndicator('none', 0);
      }
    }
  }
  
  // Update speaker indicator in UI
  function updateSpeakerIndicator(speaker, volume) {
    // Add speaker indicator to header if it doesn't exist
    let indicator = document.getElementById('interview-buddy-speaker-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'interview-buddy-speaker-indicator';
      indicator.className = 'speaker-indicator';
      headerElement.appendChild(indicator);
    }
    
    indicator.className = `speaker-indicator ${speaker}`;
    indicator.style.opacity = volume > 0 ? Math.min(volume * 3, 1) : 0.3;
    
    // Update tooltip
    switch (speaker) {
      case 'user':
        indicator.title = 'You are speaking';
        indicator.textContent = '🎤';
        break;
      case 'interviewer':
        indicator.title = 'Interviewer is speaking';
        indicator.textContent = '👥';
        break;
      default:
        indicator.title = 'Listening...';
        indicator.textContent = '👂';
    }
  }
  
  // Check if text is likely a question
  function isLikelyQuestion(text) {
    if (!text || text.trim().length < 5) return false;
    
    // Simple heuristic - ends with question mark or starts with common question words
    if (text.trim().endsWith('?')) return true;
    
    const questionStarters = [
      'what', 'how', 'why', 'when', 'where', 'who', 'which', 'can you', 
      'could you', 'would you', 'tell me', 'explain', 'describe', 'walk me through',
      'have you', 'do you', 'did you', 'will you', 'are you', 'is there'
    ];
    
    const lowerText = text.toLowerCase().trim();
    return questionStarters.some(starter => lowerText.startsWith(starter));
  }

  // Setup message listener for transcript processing
  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'TRANSCRIPT_RECEIVED') {
        processTranscript(message.transcript, message.speaker, message.final);
      } else if (message.type === 'START_AUDIO_CAPTURE') {
        handleStartAudioCapture(message, sendResponse);
        return true; // Keep message channel open for async response
      } else if (message.type === 'STOP_AUDIO_CAPTURE') {
        handleStopAudioCapture(sendResponse);
        return true;
      }
    });
  }

  // Handle start audio capture message from service worker
  async function handleStartAudioCapture(message, sendResponse) {
    console.log('Starting audio capture in content script...');
    
    try {
      // Initialize audio capture if not already done
      if (!window.interviewBuddyAudioCapture) {
        // Import and initialize audio capture
        const { default: AudioCapture } = await import(chrome.runtime.getURL('src/content/audio-capture.js'));
        window.interviewBuddyAudioCapture = new AudioCapture();
      }
      
      // Start audio capture with callbacks
      await window.interviewBuddyAudioCapture.startCapture(
        // onAudioData callback
        (audioData) => {
          // Send audio data to service worker for processing
          chrome.runtime.sendMessage({
            type: 'AUDIO_DATA',
            data: audioData,
            sessionId: message.sessionId
          });
        },
        // onSpeakerDetected callback
        (speakerInfo) => {
          // Send speaker detection to service worker
          chrome.runtime.sendMessage({
            type: 'SPEAKER_DETECTED',
            speaker: speakerInfo.speaker,
            volume: speakerInfo.volume,
            isUserSpeaking: speakerInfo.isUserSpeaking
          });
        }
      );
      
      // Set up simple speech recognition for testing
      if ('webkitSpeechRecognition' in window) {
        setupSpeechRecognition(message.apiKey);
      }
      
      sendResponse({ success: true });
      console.log('✅ Audio capture started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start audio capture:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // Handle stop audio capture message
  function handleStopAudioCapture(sendResponse) {
    console.log('Stopping audio capture in content script...');
    
    try {
      if (window.interviewBuddyAudioCapture) {
        window.interviewBuddyAudioCapture.stopCapture();
      }
      
      if (window.speechRecognition) {
        window.speechRecognition.stop();
        window.speechRecognition = null;
      }
      
      sendResponse({ success: true });
      console.log('✅ Audio capture stopped');
      
    } catch (error) {
      console.error('❌ Failed to stop audio capture:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // Setup Web Speech API for simpler transcription (fallback/testing)
  function setupSpeechRecognition(apiKey) {
    try {
      const recognition = new webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          
          if (result.isFinal) {
            console.log('Final transcript:', transcript);
            
            // Send transcript to background for processing
            chrome.runtime.sendMessage({
              type: 'TRANSCRIPT_RECEIVED',
              transcript: transcript,
              final: true,
              speaker: 'user' // Web Speech API only captures user speech
            });
            
            // Also process locally
            processTranscript(transcript, 'user', true);
          } else {
            console.log('Interim transcript:', transcript);
          }
        }
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
      };
      
      recognition.onend = () => {
        console.log('Speech recognition ended, restarting...');
        if (state.isRecording) {
          setTimeout(() => recognition.start(), 100);
        }
      };
      
      window.speechRecognition = recognition;
      recognition.start();
      
      console.log('✅ Web Speech Recognition started');
      
    } catch (error) {
      console.error('❌ Failed to setup speech recognition:', error);
    }
  }

  // Process received transcript
  function processTranscript(transcript, speaker, isFinal) {
    console.log('Received transcript:', { transcript, speaker, isFinal });
    
    if (!transcript || transcript.trim().length === 0) return;
    
    // Only process final transcripts to avoid partial text issues
    if (!isFinal) return;
    
    // Check if it's a question from the interviewer
    if (speaker === 'interviewer' && isLikelyQuestion(transcript)) {
      console.log('Question detected:', transcript);
      
      // Update the waiting question if it exists
      if (state.questions.length > 0 && state.questions[state.questions.length - 1].text === 'Waiting for question...') {
        updateLastQuestion(transcript);
      } else {
        // Add new question to the list
        addNewQuestion(transcript);
      }
      
      // Generate AI response
      generateAIResponse(transcript);
    } else if (speaker === 'user') {
      console.log('User response detected:', transcript);
      // Could be used to update context or provide feedback
    }
  }

  // Update the last question text
  function updateLastQuestion(newText) {
    if (state.questions.length === 0) return;
    
    const lastQuestion = state.questions[state.questions.length - 1];
    lastQuestion.text = newText;
    
    // Update UI
    const questionElement = document.querySelector(`[data-id="${lastQuestion.id}"]`);
    if (questionElement) {
      const textElement = questionElement.querySelector('.question-text');
      if (textElement) {
        textElement.textContent = newText;
      }
    }
    
    // Generate response for the updated question
    generateResponse(lastQuestion.id, newText);
  }

  // Generate AI response (wrapper for generateResponse)
  function generateAIResponse(text) {
    if (state.currentQuestion) {
      generateResponse(state.currentQuestion, text);
    }
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      loadStyles();
      initialize();
    });
  } else {
    loadStyles();
    initialize();
  }
})();
