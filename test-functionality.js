// Simple test script to verify Interview Buddy functionality
console.log('🧪 Starting Interview Buddy Test...');

// Test 1: Check if extension loads
chrome.runtime.getManifest ? 
  console.log('✅ Extension runtime available') : 
  console.log('❌ Extension runtime not available');

// Test 2: Check storage access
chrome.storage.local.get(['apiKeys'], function(result) {
  if (chrome.runtime.lastError) {
    console.log('❌ Storage access failed:', chrome.runtime.lastError);
  } else {
    console.log('✅ Storage access working');
    
    // Set up basic API keys for testing
    if (!result.apiKeys) {
      console.log('📝 Setting up test API keys...');
      chrome.storage.local.set({
        apiKeys: {
          assemblyai: 'test-assemblyai-key',
          gemini: 'test-gemini-key',
          openai: 'test-openai-key',
          anthropic: 'test-anthropic-key'
        },
        activeProvider: 'gemini'
      }, function() {
        console.log('✅ Test API keys configured');
      });
    } else {
      console.log('✅ API keys already configured');
    }
  }
});

// Test 3: Check if we can query tabs
chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
  if (chrome.runtime.lastError) {
    console.log('❌ Tab access failed:', chrome.runtime.lastError);
  } else {
    console.log('✅ Tab access working, active tab:', tabs[0]?.url);
  }
});

// Test 4: Test message passing
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.type === 'TEST_MESSAGE') {
    console.log('✅ Message passing working');
    sendResponse({success: true});
  }
});

// Send a test message to self
chrome.runtime.sendMessage({type: 'TEST_MESSAGE'}, function(response) {
  if (chrome.runtime.lastError) {
    console.log('❌ Self-message failed:', chrome.runtime.lastError);
  } else {
    console.log('✅ Self-message working');
  }
});

console.log('🧪 Interview Buddy Test Complete!');
console.log('📋 Next steps:');
console.log('1. Load extension in Chrome (chrome://extensions/)');
console.log('2. Visit a video call site (meet.google.com)');
console.log('3. Click the record button to test transcription');
console.log('4. Speak a question to test AI response generation');
