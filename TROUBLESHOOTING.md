# Interview Buddy Extension - Troubleshooting Guide

## 🔧 Recent Fixes Applied

### 1. Fixed Manifest File Issues
- ✅ Moved `manifest.json` to root directory
- ✅ Updated all file paths to include `src/` prefix
- ✅ Fixed icon paths and copied icons to root
- ✅ Set Gemini 2.5 Flash as default provider

### 2. Improved Audio Processing
- ✅ Updated to AssemblyAI v3 streaming API
- ✅ Lowered speaker detection thresholds for better sensitivity
- ✅ Enhanced user speech detection (threshold: 0.15 vs previous 0.3)
- ✅ Improved interviewer speech detection (threshold: 0.08)

### 3. Enhanced AI Integration
- ✅ Configured Gemini 2.5 Flash as primary model
- ✅ Increased token limit to 8192 for better responses
- ✅ Improved streaming response handling
- ✅ Better error handling and fallbacks

## 🚀 Setup Instructions

### Step 1: Load the Extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select the `/home/user/Documents/interviewbuddy` folder
5. Verify the extension loads without errors

### Step 2: Configure API Keys
1. Click the Interview Buddy extension icon
2. Go to "API Keys" tab
3. Add your API keys:
   - **AssemblyAI**: Required for transcription (get from https://assemblyai.com/)
   - **Gemini**: Primary AI provider (get from https://makersuite.google.com/)
   - **OpenAI** (optional): Backup provider
   - **Anthropic** (optional): Alternative provider

### Step 3: Test the Extension
1. Open a video call (Zoom, Google Meet, or Teams)
2. Click the Interview Buddy icon
3. Click "Launch Interview Assistant"
4. Grant microphone permissions when prompted
5. Start speaking - you should see speaker indicators

## 🐛 Common Issues and Solutions

### Issue: "Failed to load extension - Manifest file is missing"
**Solution**: 
- Ensure `manifest.json` is in the root directory
- Check that all file paths in manifest start with `src/`
- Verify icon files exist in both root and `src/assets/icons/`

### Issue: "Nothing happens when I speak"
**Solutions**:
1. **Check microphone permissions**:
   - Go to Chrome settings > Privacy and security > Site settings > Microphone
   - Ensure the meeting site has microphone access
   
2. **Verify API keys**:
   - Open extension popup > API Keys tab
   - Ensure AssemblyAI key is set (required for transcription)
   - Ensure at least one AI provider key is set

3. **Test audio levels**:
   - Speak louder or closer to microphone
   - Check if speaker indicator responds to your voice
   - Threshold lowered to 0.15 for better sensitivity

### Issue: "AssemblyAI connection fails"
**Solutions**:
1. **Check API key format**:
   - AssemblyAI keys start with letters/numbers (no `sk-` prefix)
   - Verify key is active and has credits
   
2. **Network connectivity**:
   - Ensure no firewall blocking WebSocket connections
   - Try on different network if corporate firewall is present
   
3. **Updated endpoint**:
   - Now using AssemblyAI v3 streaming API
   - Endpoint: `wss://streaming.assemblyai.com/v3/ws`

### Issue: "AI responses not generating"
**Solutions**:
1. **Check provider configuration**:
   - Default is now Gemini 2.5 Flash
   - Verify Gemini API key is correct
   - Format: Standard Google API key (not OAuth)
   
2. **API quotas**:
   - Check if you've exceeded API limits
   - Try switching to backup provider (OpenAI/Anthropic)
   
3. **Question detection**:
   - Speak clearly and ask proper questions
   - Questions should end with "?" or start with question words
   - Enhanced detection now includes: "walk me through", "tell me", etc.

### Issue: "Extension not detecting questions"
**Solutions**:
1. **Improved question detection**:
   - Added more question starters: "walk me through", "tell me about", etc.
   - Questions ending with "?" are automatically detected
   - Clear speech required for transcription accuracy

2. **Speaker detection**:
   - User threshold lowered to 0.15 (was 0.3)
   - Interviewer threshold lowered to 0.08
   - Should be more sensitive to speech now

## 📊 Performance Monitoring

### Check Extension Status
```javascript
// Run in browser console to check status
chrome.runtime.sendMessage({type: 'GET_STATE'}, (response) => {
  console.log('Extension State:', response.state);
});
```

### Monitor Audio Levels
The extension now provides visual feedback:
- 🎤 = User speaking
- 👥 = Interviewer speaking  
- 👂 = Listening

### Check API Connectivity
1. Open browser DevTools (F12)
2. Go to Network tab
3. Look for WebSocket connections to AssemblyAI
4. Check for API calls to ai.google.dev (Gemini)

## 🔄 Reset and Troubleshooting

### Reset Extension Settings
1. Open extension popup
2. Go to Settings tab
3. Or manually clear storage:
```javascript
chrome.storage.local.clear(() => {
  console.log('Extension storage cleared');
});
```

### Reload Extension
1. Go to `chrome://extensions/`
2. Find Interview Buddy
3. Click reload button
4. Reconfigure API keys

### Check Browser Console
1. Open DevTools (F12)
2. Check Console tab for errors
3. Look for Interview Buddy related messages
4. Common errors:
   - Microphone access denied
   - API key invalid
   - Network connectivity issues

## 📈 Expected Behavior

### When Working Correctly:
1. Extension loads without manifest errors
2. Microphone access granted successfully
3. Speaker indicators respond to voice
4. Questions are automatically detected and transcribed
5. AI responses generate within 2-3 seconds
6. Responses stream in real-time (word by word)

### Performance Metrics:
- **Transcription latency**: < 500ms
- **AI response time**: 2-3 seconds for first word
- **Speaker detection**: Near real-time
- **Question detection**: Immediate on final transcript

## 🆘 Getting Help

If issues persist:
1. Check browser console for specific error messages
2. Verify all API keys are correct and active
3. Test on different video call platforms
4. Try different microphone/audio setup
5. Check network connectivity to API endpoints

The extension should now work much better with:
- ✅ Improved audio sensitivity
- ✅ Better question detection  
- ✅ Gemini 2.5 Flash integration
- ✅ More reliable transcription
- ✅ Enhanced error handling
