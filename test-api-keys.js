// Test script to check if API keys are configured
chrome.storage.local.get(['apiKeys'], function(result) {
  console.log('Current API keys:', result.apiKeys);
  
  if (!result.apiKeys) {
    console.log('❌ No API keys found. Please set up API keys in extension settings.');
    
    // Set up basic API keys for testing
    chrome.storage.local.set({
      apiKeys: {
        assemblyai: 'your-assemblyai-key-here',
        gemini: 'your-gemini-key-here',
        openai: 'your-openai-key-here',
        anthropic: 'your-anthropic-key-here'
      }
    }, function() {
      console.log('✅ Basic API key structure created. Please update with real keys.');
    });
  } else {
    console.log('✅ API keys found:');
    console.log('- AssemblyAI:', result.apiKeys.assemblyai ? '✓ Set' : '❌ Missing');
    console.log('- Gemini:', result.apiKeys.gemini ? '✓ Set' : '❌ Missing');
    console.log('- OpenAI:', result.apiKeys.openai ? '✓ Set' : '❌ Missing');
    console.log('- Anthropic:', result.apiKeys.anthropic ? '✓ Set' : '❌ Missing');
  }
});
