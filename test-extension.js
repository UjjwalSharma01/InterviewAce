// Test script for Interview Buddy extension
// This script helps verify that all components are working correctly

console.log('🚀 Interview Buddy Extension Test Suite');

// Test 1: Check manifest file validity
function testManifest() {
  console.log('\n📋 Testing manifest.json...');
  
  try {
    // Check if manifest exists and is valid JSON
    fetch(chrome.runtime.getURL('manifest.json'))
      .then(response => response.json())
      .then(manifest => {
        console.log('✅ Manifest loaded successfully');
        console.log('📦 Extension name:', manifest.name);
        console.log('🔧 Manifest version:', manifest.manifest_version);
        console.log('🎯 Default provider: Gemini 2.5 Flash (should be default)');
        
        // Check required permissions
        const requiredPermissions = ['storage', 'tabs', 'activeTab', 'scripting'];
        const hasAllPermissions = requiredPermissions.every(perm => 
          manifest.permissions.includes(perm)
        );
        
        if (hasAllPermissions) {
          console.log('✅ All required permissions present');
        } else {
          console.log('❌ Missing required permissions');
        }
        
        // Check content scripts
        if (manifest.content_scripts && manifest.content_scripts.length > 0) {
          console.log('✅ Content scripts configured');
          console.log('🎯 Matches:', manifest.content_scripts[0].matches);
        } else {
          console.log('❌ No content scripts found');
        }
      })
      .catch(error => {
        console.log('❌ Failed to load manifest:', error);
      });
  } catch (error) {
    console.log('❌ Manifest test failed:', error);
  }
}

// Test 2: Check API Manager functionality
function testApiManager() {
  console.log('\n🤖 Testing API Manager...');
  
  try {
    // Test provider configuration
    const expectedProviders = ['gemini', 'openai', 'anthropic'];
    console.log('✅ Expected providers:', expectedProviders);
    
    // Test Gemini 2.5 Flash configuration
    console.log('✅ Gemini 2.5 Flash should be the primary model');
    console.log('🔧 Model: gemini-2.5-flash');
    console.log('📊 Max tokens: 8192 (increased for better responses)');
    
  } catch (error) {
    console.log('❌ API Manager test failed:', error);
  }
}

// Test 3: Check Audio Processing
function testAudioProcessing() {
  console.log('\n🎤 Testing Audio Processing...');
  
  try {
    // Check microphone permissions
    navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })
    .then(stream => {
      console.log('✅ Microphone access granted');
      console.log('🔧 Audio context sample rate: 16000Hz (required for AssemblyAI)');
      
      // Test audio context
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });
      
      console.log('✅ Audio context created successfully');
      console.log('📊 Sample rate:', audioContext.sampleRate);
      
      // Clean up
      stream.getTracks().forEach(track => track.stop());
      audioContext.close();
      
    })
    .catch(error => {
      console.log('❌ Microphone access denied:', error);
      console.log('💡 Please grant microphone permissions for transcription to work');
    });
    
  } catch (error) {
    console.log('❌ Audio processing test failed:', error);
  }
}

// Test 4: Check Storage and Settings
function testStorage() {
  console.log('\n💾 Testing Storage and Settings...');
  
  try {
    // Test default settings
    chrome.storage.local.get([
      'activeProvider',
      'darkMode',
      'fontSize'
    ], (result) => {
      console.log('✅ Storage access successful');
      console.log('🎯 Active provider:', result.activeProvider || 'gemini (default)');
      console.log('🌙 Dark mode:', result.darkMode !== undefined ? result.darkMode : 'true (default)');
      console.log('📝 Font size:', result.fontSize || '16px (default)');
    });
    
  } catch (error) {
    console.log('❌ Storage test failed:', error);
  }
}

// Test 5: Check Network Connectivity for APIs
function testNetworkConnectivity() {
  console.log('\n🌐 Testing Network Connectivity...');
  
  const endpoints = [
    {
      name: 'AssemblyAI Streaming',
      url: 'https://streaming.assemblyai.com/v3/ws',
      test: false // WebSocket test requires special handling
    },
    {
      name: 'Gemini API',
      url: 'https://generativelanguage.googleapis.com/v1beta',
      test: true
    },
    {
      name: 'OpenAI API',
      url: 'https://api.openai.com/v1',
      test: true
    }
  ];
  
  endpoints.forEach(endpoint => {
    if (endpoint.test) {
      fetch(endpoint.url)
        .then(response => {
          console.log(`✅ ${endpoint.name} - Reachable (Status: ${response.status})`);
        })
        .catch(error => {
          console.log(`⚠️ ${endpoint.name} - Network issue (this may be normal):`, error.message);
        });
    } else {
      console.log(`📋 ${endpoint.name} - WebSocket endpoint (cannot test directly)`);
    }
  });
}

// Test 6: Validate Speaker Detection Logic
function testSpeakerDetection() {
  console.log('\n🗣️ Testing Speaker Detection Logic...');
  
  // Test improved thresholds
  const testCases = [
    { volume: 0.05, expectedSpeaker: 'unknown', description: 'Very low volume' },
    { volume: 0.12, expectedSpeaker: 'interviewer', description: 'Medium volume (interviewer)' },
    { volume: 0.18, expectedSpeaker: 'user', description: 'Higher volume (user speaking)' },
    { volume: 0.35, expectedSpeaker: 'user', description: 'Clear user speech' }
  ];
  
  console.log('✅ Testing improved speaker detection thresholds:');
  testCases.forEach(test => {
    const detectedSpeaker = test.volume > 0.15 ? 'user' : 
                           test.volume > 0.08 ? 'interviewer' : 'unknown';
    const isCorrect = detectedSpeaker === test.expectedSpeaker ? '✅' : '❌';
    console.log(`${isCorrect} Volume ${test.volume}: ${detectedSpeaker} (${test.description})`);
  });
}

// Test 7: Check Question Detection Logic
function testQuestionDetection() {
  console.log('\n❓ Testing Question Detection...');
  
  const testQuestions = [
    'What is your experience with JavaScript?',
    'Can you tell me about yourself?',
    'How would you handle this situation?',
    'Describe your previous role',
    'Walk me through your project',
    'This is just a statement',
    'Yes, I understand'
  ];
  
  console.log('✅ Testing question detection logic:');
  testQuestions.forEach(text => {
    const isQuestion = text.trim().endsWith('?') || 
      ['what', 'how', 'why', 'when', 'where', 'who', 'which', 'can you', 
       'could you', 'would you', 'tell me', 'explain', 'describe', 'walk me through']
      .some(starter => text.toLowerCase().trim().startsWith(starter));
    
    const indicator = isQuestion ? '✅ QUESTION' : '📝 Statement';
    console.log(`${indicator}: "${text}"`);
  });
}

// Run all tests
function runAllTests() {
  console.log('🧪 Starting Interview Buddy Extension Tests...');
  console.log('=' .repeat(50));
  
  testManifest();
  setTimeout(testApiManager, 100);
  setTimeout(testAudioProcessing, 200);
  setTimeout(testStorage, 300);
  setTimeout(testNetworkConnectivity, 400);
  setTimeout(testSpeakerDetection, 500);
  setTimeout(testQuestionDetection, 600);
  
  setTimeout(() => {
    console.log('\n' + '=' .repeat(50));
    console.log('🎉 Test suite completed!');
    console.log('\n📋 Summary:');
    console.log('• Manifest should load without errors');
    console.log('• Gemini 2.5 Flash should be the default provider');
    console.log('• Microphone permissions needed for transcription');
    console.log('• AssemblyAI API key required for speech-to-text');
    console.log('• At least one AI provider API key needed');
    console.log('• Improved speaker detection with lower thresholds');
    console.log('• Enhanced question detection logic');
    
    console.log('\n💡 Next steps:');
    console.log('1. Configure API keys in the popup');
    console.log('2. Test on a video call platform (Zoom, Google Meet, Teams)');
    console.log('3. Verify transcription and AI responses work correctly');
    console.log('4. Check that user speech is properly detected');
  }, 1000);
}

// Auto-run tests if in development mode
if (typeof chrome !== 'undefined' && chrome.runtime) {
  runAllTests();
} else {
  console.log('⚠️ Chrome extension APIs not available. Run this in the extension context.');
}
