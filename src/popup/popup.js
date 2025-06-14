// Popup script for Interview Buddy extension
document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI
  initializeTabs();
  loadSettings();
  loadApiKeys();
  setupEventListeners();
  updateStatus();
});

// Initialize tabs
function initializeTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Deactivate all tabs
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Activate selected tab
      button.classList.add('active');
      const tabName = button.dataset.tab;
      document.getElementById(`${tabName}-tab`).classList.add('active');
    });
  });
}

// Load settings from storage
function loadSettings() {
  chrome.storage.local.get([
    'darkMode',
    'lowContrast',
    'fontSize',
    'activeProvider',
    'lastUsed'
  ], (result) => {
    // Dark mode
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (result.darkMode !== undefined) {
      darkModeToggle.checked = result.darkMode;
      updateTheme(result.darkMode);
    }
    
    // Low contrast mode
    const lowContrastToggle = document.getElementById('low-contrast-toggle');
    if (result.lowContrast !== undefined) {
      lowContrastToggle.checked = result.lowContrast;
    }
    
    // Font sizes
    if (result.fontSize) {
      const questionSize = document.getElementById('question-font-size');
      const responseSize = document.getElementById('response-font-size');
      
      questionSize.value = result.fontSize.questions || 16;
      responseSize.value = result.fontSize.responses || 16;
      
      document.getElementById('question-size-value').textContent = `${questionSize.value}px`;
      document.getElementById('response-size-value').textContent = `${responseSize.value}px`;
    }
    
    // Active provider
    if (result.activeProvider) {
      updateActiveProvider(result.activeProvider);
    }
    
    // Last used
    if (result.lastUsed) {
      document.getElementById('last-used').textContent = new Date(result.lastUsed).toLocaleString();
    }
  });
}

// Load API keys from storage
function loadApiKeys() {
  chrome.storage.local.get(['apiKeys'], (result) => {
    if (result.apiKeys) {
      const keys = result.apiKeys;
      
      // Set input values if keys exist
      if (keys.openai) {
        document.getElementById('openai-api-key').value = keys.openai;
        document.getElementById('openai-status').textContent = 'Set';
        document.getElementById('openai-status').classList.add('success');
      }
      
      if (keys.anthropic) {
        document.getElementById('anthropic-api-key').value = keys.anthropic;
        document.getElementById('anthropic-status').textContent = 'Set';
        document.getElementById('anthropic-status').classList.add('success');
      }
      
      if (keys.gemini) {
        document.getElementById('gemini-api-key').value = keys.gemini;
        document.getElementById('gemini-status').textContent = 'Set';
        document.getElementById('gemini-status').classList.add('success');
      }
      
      if (keys.assemblyai) {
        document.getElementById('assemblyai-api-key').value = keys.assemblyai;
        document.getElementById('assemblyai-status').textContent = 'Set';
        document.getElementById('assemblyai-status').classList.add('success');
      }
    }
  });
}

// Setup event listeners
function setupEventListeners() {
  // Dark mode toggle
  document.getElementById('dark-mode-toggle').addEventListener('change', (e) => {
    updateTheme(e.target.checked);
  });
  
  // Font size sliders
  document.getElementById('question-font-size').addEventListener('input', (e) => {
    document.getElementById('question-size-value').textContent = `${e.target.value}px`;
  });
  
  document.getElementById('response-font-size').addEventListener('input', (e) => {
    document.getElementById('response-size-value').textContent = `${e.target.value}px`;
  });
  
  // Save settings button
  document.getElementById('save-settings-button').addEventListener('click', saveSettings);
  
  // Save API keys button
  document.getElementById('save-api-keys-button').addEventListener('click', saveApiKeys);
  
  // Toggle API key visibility buttons
  document.querySelectorAll('.toggle-visibility').forEach(button => {
    button.addEventListener('click', () => {
      const inputId = button.dataset.for;
      const input = document.getElementById(inputId);
      
      if (input.type === 'password') {
        input.type = 'text';
        button.textContent = '🔒';
      } else {
        input.type = 'password';
        button.textContent = '👁️';
      }
    });
  });
  
  // Launch button
  document.getElementById('launch-button').addEventListener('click', launchAssistant);
}

// Update theme based on dark mode setting
function updateTheme(isDarkMode) {
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
}

// Update active provider display
function updateActiveProvider(provider) {
  const providerNames = {
    openai: 'OpenAI GPT-4',
    anthropic: 'Claude 3.5',
    gemini: 'Gemini 2.5 Flash'
  };
  
  const providerBadge = document.querySelector('.provider-badge');
  
  document.getElementById('active-provider').textContent = providerNames[provider] || 'Unknown';
  
  // Update badge class
  providerBadge.className = 'provider-badge';
  providerBadge.classList.add(provider);
  providerBadge.textContent = provider.charAt(0).toUpperCase() + provider.slice(1);
}

// Save settings to storage
function saveSettings() {
  const darkMode = document.getElementById('dark-mode-toggle').checked;
  const lowContrast = document.getElementById('low-contrast-toggle').checked;
  const questionSize = parseInt(document.getElementById('question-font-size').value);
  const responseSize = parseInt(document.getElementById('response-font-size').value);
  
  const settings = {
    darkMode,
    lowContrast,
    fontSize: {
      questions: questionSize,
      responses: responseSize
    }
  };
  
  chrome.storage.local.set(settings, () => {
    showToast('Settings saved successfully');
  });
}

// Save API keys to storage
function saveApiKeys() {
  const openaiKey = document.getElementById('openai-api-key').value.trim();
  const anthropicKey = document.getElementById('anthropic-api-key').value.trim();
  const geminiKey = document.getElementById('gemini-api-key').value.trim();
  const assemblyaiKey = document.getElementById('assemblyai-api-key').value.trim();
  
  const apiKeys = {};
  
  if (openaiKey) apiKeys.openai = openaiKey;
  if (anthropicKey) apiKeys.anthropic = anthropicKey;
  if (geminiKey) apiKeys.gemini = geminiKey;
  if (assemblyaiKey) apiKeys.assemblyai = assemblyaiKey;
  
  chrome.storage.local.set({ apiKeys }, () => {
    // Update status indicators
    updateApiKeyStatus('openai', !!openaiKey);
    updateApiKeyStatus('anthropic', !!anthropicKey);
    updateApiKeyStatus('gemini', !!geminiKey);
    updateApiKeyStatus('assemblyai', !!assemblyaiKey);
    
    showToast('API keys saved successfully');
  });
}

// Update API key status indicator
function updateApiKeyStatus(provider, isSet) {
  const statusElement = document.getElementById(`${provider}-status`);
  
  if (isSet) {
    statusElement.textContent = 'Set';
    statusElement.classList.add('success');
  } else {
    statusElement.textContent = 'Not set';
    statusElement.classList.remove('success');
  }
}

// Launch the interview assistant
function launchAssistant() {
  // Check if we have the necessary API keys
  chrome.storage.local.get(['apiKeys'], (result) => {
    if (!result.apiKeys || !result.apiKeys.assemblyai) {
      showToast('AssemblyAI API key is required for transcription', 'error');
      
      // Switch to API keys tab
      document.querySelector('[data-tab="api-keys"]').click();
      return;
    }
    
    // Check if at least one AI provider API key is set
    const hasAiProvider = result.apiKeys.openai || result.apiKeys.anthropic || result.apiKeys.gemini;
    
    if (!hasAiProvider) {
      showToast('At least one AI provider API key is required', 'error');
      
      // Switch to API keys tab
      document.querySelector('[data-tab="api-keys"]').click();
      return;
    }
    
    // Find a meeting tab to inject the assistant
    chrome.tabs.query({
      url: [
        'https://*.zoom.us/j/*',
        'https://*.zoom.us/s/*',
        'https://meet.google.com/*',
        'https://teams.microsoft.com/*'
      ]
    }, (tabs) => {
      if (tabs.length === 0) {
        showToast('No active meeting found. Open a supported video call first.', 'error');
        return;
      }
      
      // Update last used timestamp
      chrome.storage.local.set({ lastUsed: Date.now() });
      
      // Send message to activate the assistant in the meeting tab
      chrome.tabs.sendMessage(tabs[0].id, { action: 'ACTIVATE_ASSISTANT' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          showToast('Error activating assistant', 'error');
        } else if (response && response.success) {
          showToast('Interview assistant activated');
          window.close(); // Close the popup
        }
      });
    });
  });
}

// Update status information
function updateStatus() {
  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
    if (response && response.state) {
      const state = response.state;
      
      // Update active provider
      if (state.activeProvider) {
        updateActiveProvider(state.activeProvider);
      }
      
      // Update recording status if needed
      if (state.isRecording) {
        document.querySelector('.status-pill').textContent = 'Recording';
        document.querySelector('.status-pill').classList.remove('success');
        document.querySelector('.status-pill').classList.add('error');
      }
    }
  });
}

// Show toast notification
function showToast(message, type = 'success') {
  // Remove existing toast if any
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  // Create new toast
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  // Add styles
  toast.style.position = 'fixed';
  toast.style.bottom = '20px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.padding = '10px 16px';
  toast.style.borderRadius = '4px';
  toast.style.backgroundColor = type === 'success' ? 'rgba(56, 176, 0, 0.9)' : 'rgba(230, 57, 70, 0.9)';
  toast.style.color = 'white';
  toast.style.fontSize = '14px';
  toast.style.zIndex = '10000';
  toast.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
  
  // Add to DOM
  document.body.appendChild(toast);
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease-out';
    
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}
