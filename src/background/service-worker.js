// Background service worker for handling API calls and audio processing
import ApiManager from './api-manager.js';
import AudioProcessor from './audio-processor.js';

const API_PROVIDERS = {
  GEMINI: 'gemini',
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic'
};

// State management
let currentState = {
  activeProvider: API_PROVIDERS.GEMINI, // Set Gemini as default
  isRecording: false,
  screenSharing: false,
  sessionId: generateSessionId(),
  context: [],
  apiKeys: {},
  apiManager: null,
  audioProcessor: null
};

// Initialize when the service worker starts
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Interview Buddy extension installed');
  
  // Initialize API manager and audio processor
  currentState.apiManager = new ApiManager();
  currentState.audioProcessor = new AudioProcessor();
  
  // Load stored settings
  const storedSettings = await chrome.storage.local.get([
    'activeProvider',
    'apiKeys',
    'fontSize',
    'darkMode',
    'lowContrast'
  ]);
  
  if (storedSettings.activeProvider) {
    currentState.activeProvider = storedSettings.activeProvider;
  } else {
    // Set Gemini as default and save it
    currentState.activeProvider = API_PROVIDERS.GEMINI;
    await chrome.storage.local.set({ activeProvider: API_PROVIDERS.GEMINI });
  }
  
  if (storedSettings.apiKeys) {
    currentState.apiKeys = storedSettings.apiKeys;
  }
  
  // Set default settings if not present
  if (!storedSettings.fontSize) {
    await chrome.storage.local.set({
      fontSize: {
        questions: 16,
        responses: 16
      }
    });
  }
  
  if (storedSettings.darkMode === undefined) {
    await chrome.storage.local.set({ darkMode: true });
  }
  
  if (storedSettings.lowContrast === undefined) {
    await chrome.storage.local.set({ lowContrast: false });
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle different message types
  switch (message.type) {
    case 'START_TRANSCRIPTION':
      handleStartTranscription(message, sendResponse);
      return true; // Keep the message channel open for async response
      
    case 'STOP_TRANSCRIPTION':
      handleStopTranscription(sendResponse);
      return true;
      
    case 'GENERATE_AI_RESPONSE':
      handleGenerateAIResponse(message, sendResponse);
      return true;
      
    case 'REGENERATE_RESPONSE':
      handleRegenerateResponse(message, sendResponse);
      return true;
      
    case 'CHANGE_PROVIDER':
      handleChangeProvider(message.provider, sendResponse);
      return false;
      
    case 'CHECK_SCREEN_SHARING':
      checkScreenSharing(sendResponse);
      return true;
      
    case 'GET_STATE':
      sendResponse({ state: currentState });
      return false;
      
    case 'CLEAR_CONTEXT':
      currentState.context = [];
      sendResponse({ success: true });
      return false;
  }
});

// Check if screen is being shared
async function checkScreenSharing(sendResponse) {
  try {
    // This is a simplified version. In a real implementation,
    // you would need to use the chrome.desktopCapture API
    // to detect if screen sharing is active
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      // In a real implementation, you would check if the current tab
      // is being shared
      currentState.screenSharing = false; // placeholder
      sendResponse({ isScreenSharing: currentState.screenSharing });
    });
  } catch (error) {
    console.error('Error checking screen sharing:', error);
    sendResponse({ isScreenSharing: false, error: error.message });
  }
}

// Handle starting transcription
async function handleStartTranscription(message, sendResponse) {
  try {
    if (currentState.isRecording) {
      sendResponse({ success: false, error: 'Already recording' });
      return;
    }
    
    // Initialize audio processor if not already done
    if (!currentState.audioProcessor) {
      currentState.audioProcessor = new AudioProcessor();
    }
    
    // Get API keys from storage
    const result = await chrome.storage.local.get(['apiKeys']);
    if (!result.apiKeys || !result.apiKeys.assemblyai) {
      sendResponse({ success: false, error: 'AssemblyAI API key not configured. Please set it in settings.' });
      return;
    }
    
    // Start transcription with AssemblyAI
    const success = await currentState.audioProcessor.startTranscription(
      result.apiKeys.assemblyai,
      currentState.sessionId,
      (transcript, speaker) => {
        // Forward transcript to content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'TRANSCRIPT_RECEIVED',
              transcript: transcript.text,
              speaker: speaker,
              final: transcript.final
            });
          }
        });
      }
    );
    
    if (success) {
      currentState.isRecording = true;
      sendResponse({ success: true, sessionId: currentState.sessionId });
    } else {
      sendResponse({ success: false, error: 'Failed to connect to AssemblyAI' });
    }
  } catch (error) {
    console.error('Error starting transcription:', error);
    currentState.isRecording = false;
    sendResponse({ success: false, error: error.message });
  }
}

// Handle stopping transcription
function handleStopTranscription(sendResponse) {
  try {
    if (!currentState.isRecording) {
      sendResponse({ success: false, error: 'Not recording' });
      return;
    }
    
    // Stop transcription
    if (currentState.audioProcessor) {
      currentState.audioProcessor.stopTranscription();
    }
    
    currentState.isRecording = false;
    sendResponse({ success: true });
  } catch (error) {
    console.error('Error stopping transcription:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle generating AI response
async function handleGenerateAIResponse(message, sendResponse) {
  try {
    const { text, questionId } = message;
    
    // Initialize API manager if not already done
    if (!currentState.apiManager) {
      currentState.apiManager = new ApiManager();
    }
    
    // Add to context
    currentState.context.push({
      role: 'user',
      content: text,
      id: questionId,
      timestamp: Date.now()
    });
    
    // Prune context if needed
    pruneContext();
    
    // Get API key for the current provider
    const apiKey = currentState.apiKeys[currentState.activeProvider];
    
    if (!apiKey) {
      sendResponse({ 
        success: false, 
        error: `API key not set for ${currentState.activeProvider}. Please configure your API key in the settings.` 
      });
      return;
    }
    
    try {
      // Create interview context messages
      const systemPrompt = {
        role: 'system',
        content: `You are an AI interview assistant helping a candidate during their interview. 
        
        Your role is to:
        1. Provide concise, helpful responses to technical and behavioral interview questions
        2. Give structured answers using frameworks like STAR method when appropriate
        3. Keep responses professional but conversational
        4. Focus on practical examples and real-world applications
        5. Be encouraging and supportive
        
        Question: "${text}"
        
        Please provide a comprehensive but concise answer that demonstrates knowledge and experience.`
      };
      
      const messages = [systemPrompt, ...currentState.context.slice(-5)]; // Keep last 5 context items
      
      // Generate response using the API manager
      let responseText = '';
      
      // Stream the response
      const streamResponse = await currentState.apiManager.generateResponse(
        messages,
        currentState.activeProvider,
        apiKey
      );
      
      await currentState.apiManager.processStream(
        streamResponse,
        currentState.activeProvider,
        (chunk) => {
          responseText += chunk;
          // Send incremental updates to the content script
          chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, {
                type: 'AI_RESPONSE_CHUNK',
                chunk: chunk,
                questionId: questionId,
                isComplete: false
              });
            }
          });
        }
      );
      
      // Add response to context
      currentState.context.push({
        role: 'assistant',
        content: responseText,
        id: questionId,
        timestamp: Date.now()
      });
      
      // Send final response
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'AI_RESPONSE_CHUNK',
            chunk: '',
            questionId: questionId,
            isComplete: true
          });
        }
      });
      
      sendResponse({ 
        success: true, 
        response: responseText,
        provider: currentState.activeProvider
      });
      
    } catch (apiError) {
      console.error('API Error:', apiError);
      sendResponse({ 
        success: false, 
        error: `Failed to generate response: ${apiError.message}` 
      });
    }
    
  } catch (error) {
    console.error('Error generating AI response:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle regenerating a response with possibly a different provider
async function handleRegenerateResponse(message, sendResponse) {
  try {
    const { questionId, provider } = message;
    
    // Find the question in the context
    const questionIndex = currentState.context.findIndex(
      item => item.id === questionId && item.role === 'user'
    );
    
    if (questionIndex === -1) {
      sendResponse({ success: false, error: 'Question not found' });
      return;
    }
    
    const question = currentState.context[questionIndex];
    
    // Remove the old response if it exists
    if (questionIndex + 1 < currentState.context.length && 
        currentState.context[questionIndex + 1].role === 'assistant') {
      currentState.context.splice(questionIndex + 1, 1);
    }
    
    // Use the provided provider or the current one
    const providerToUse = provider || currentState.activeProvider;
    
    // Get API key for the provider
    const apiKey = currentState.apiKeys[providerToUse];
    
    if (!apiKey) {
      sendResponse({ 
        success: false, 
        error: `API key not set for ${providerToUse}` 
      });
      return;
    }
    
    // Generate new response
    const aiResponse = await simulateAIResponse(providerToUse, question.content);
    
    // Add response to context
    currentState.context.splice(questionIndex + 1, 0, {
      role: 'assistant',
      content: aiResponse,
      id: questionId
    });
    
    sendResponse({ 
      success: true, 
      response: aiResponse,
      provider: providerToUse
    });
    
  } catch (error) {
    console.error('Error regenerating response:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle changing the AI provider
function handleChangeProvider(provider, sendResponse) {
  if (!Object.values(API_PROVIDERS).includes(provider)) {
    sendResponse({ success: false, error: 'Invalid provider' });
    return;
  }
  
  currentState.activeProvider = provider;
  
  // Save to storage
  chrome.storage.local.set({ activeProvider: provider });
  
  sendResponse({ success: true });
}

// Helper function to simulate AI response (would be replaced with actual API calls)
async function simulateAIResponse(provider, text) {
  // In a real implementation, this would call the appropriate AI API
  
  // Add a small delay to simulate network latency
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Return a mock response based on the provider
  switch (provider) {
    case API_PROVIDERS.OPENAI:
      return `[OpenAI] Here's my response to: "${text.substring(0, 30)}..."`;
    case API_PROVIDERS.ANTHROPIC:
      return `[Claude] I'd like to help with: "${text.substring(0, 30)}..."`;
    case API_PROVIDERS.GEMINI:
      return `[Gemini] My thoughts on: "${text.substring(0, 30)}..."`;
    default:
      return `I'm not sure how to respond to that question.`;
  }
}

// Helper function to prune context to stay within token limits
function pruneContext() {
  // Keep only the last 10 interactions (5 questions and 5 answers)
  if (currentState.context.length > 20) {
    // Keep the first interaction for context
    const firstInteraction = currentState.context.slice(0, 2);
    // And the last 9 interactions
    const recentInteractions = currentState.context.slice(-18);
    currentState.context = [...firstInteraction, ...recentInteractions];
  }
}

// Helper function to generate a random session ID
function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Audio processing module (would be imported in a real implementation)
class AudioProcessor {
  constructor() {
    this.isProcessing = false;
    this.assemblyaiWebsocket = null;
  }
  
  // Methods for audio processing would be implemented here
}

// Auto-save context every 30 seconds
setInterval(() => {
  if (currentState.context.length > 0) {
    chrome.storage.local.set({ 
      [`session_${currentState.sessionId}`]: {
        context: currentState.context,
        timestamp: Date.now()
      }
    });
  }
}, 30000);

// Clean up old sessions (older than 4 hours) on startup
(async function cleanupOldSessions() {
  const storage = await chrome.storage.local.get(null);
  const fourHoursAgo = Date.now() - (4 * 60 * 60 * 1000);
  
  for (const [key, value] of Object.entries(storage)) {
    if (key.startsWith('session_') && value.timestamp < fourHoursAgo) {
      chrome.storage.local.remove(key);
    }
  }
})();
