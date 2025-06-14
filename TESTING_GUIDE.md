# Interview Buddy Extension - Testing Guide

## Quick Test Steps

### 1. Load Extension in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked" and select the `/home/user/Documents/interviewbuddy` folder
4. The extension should load without errors

### 2. Configure API Keys (REQUIRED)
Before testing, you need to set up API keys:

**Method 1: Using Test Script**
1. Open Chrome Developer Tools (F12)
2. Go to Console tab
3. Paste and run the content from `test-api-keys.js`
4. Replace the placeholder keys with real API keys

**Method 2: Through Extension Settings**
1. Click the Interview Buddy extension icon
2. Go to Settings
3. Enter your API keys:
   - **AssemblyAI** (required for transcription): Get from https://www.assemblyai.com/
   - **Gemini** (default AI): Get from https://aistudio.google.com/
   - **OpenAI** (optional): Get from https://platform.openai.com/
   - **Anthropic** (optional): Get from https://console.anthropic.com/

### 3. Test Basic Functionality

**Step 1: Visit a Video Call Platform**
- Go to https://meet.google.com/ or https://zoom.us/
- The floating Interview Buddy window should appear

**Step 2: Test Recording**
- Click the red record button (⏺)
- You should see:
  - Button turns active/highlighted
  - "Recording started" notification
  - "Waiting for question..." appears in the questions list

**Step 3: Test Audio Detection**
- Speak into your microphone
- You should see a microphone indicator (🎤) in the header when you speak
- If someone else speaks or you play audio, you should see the interviewer indicator (👥)

**Step 4: Test Question Detection**
- Say or play a question like "What is your biggest strength?"
- The extension should:
  - Detect it as a question
  - Replace "Waiting for question..." with the actual question
  - Generate an AI response using Gemini 2.5 Flash

### 4. Troubleshooting Common Issues

**Issue: Extension won't load**
- Check Chrome console for errors
- Verify all files are in correct locations
- Ensure manifest.json is in the root directory

**Issue: "Failed to start recording" error**
- Make sure you've set up API keys (especially AssemblyAI)
- Check that microphone permissions are granted
- Look at the Chrome console for detailed error messages

**Issue: No questions detected**
- Verify AssemblyAI API key is valid and has credits
- Check Chrome console for WebSocket connection errors
- Try speaking more clearly or adjusting microphone levels

**Issue: CSS not loading**
- Check that `src/assets/styles/floating-window.css` exists
- Verify `web_accessible_resources` in manifest.json
- Reload the extension

**Issue: Audio context errors**
- Click the record button to start with user gesture
- Ensure you're on HTTPS (required for microphone access)
- Check Chrome's site permissions for microphone access

### 5. Testing Checklist

- [ ] Extension loads without manifest errors
- [ ] Floating window appears on video call sites
- [ ] Record button starts/stops recording
- [ ] API keys are configured
- [ ] Microphone access is granted
- [ ] Questions are transcribed correctly
- [ ] AI responses are generated
- [ ] Speaker detection works (user vs interviewer)
- [ ] Window can be dragged and resized
- [ ] Settings panel opens
- [ ] Different AI providers can be selected

### 6. API Key Requirements

**AssemblyAI (Required)**
- Needed for: Real-time speech-to-text transcription
- Free tier: 5 hours/month
- Sign up: https://www.assemblyai.com/

**Google Gemini (Default AI)**
- Needed for: Generating interview responses
- Free tier: Generous limits
- Sign up: https://aistudio.google.com/

**Optional APIs**
- OpenAI: For GPT-4 responses
- Anthropic: For Claude responses

### 7. Expected Behavior

When working correctly:
1. Extension loads on video call platforms
2. Record button successfully starts transcription
3. Spoken questions are detected and transcribed
4. AI generates helpful interview responses
5. Speaker detection distinguishes between user and interviewer
6. UI is responsive and functional

### 8. Debug Information

Check Chrome Developer Tools Console for:
- Connection status to AssemblyAI
- API key validation messages
- Transcript processing logs
- Error messages with specific details

### 9. Performance Tips

- Use headphones to reduce echo/feedback
- Speak clearly for better transcription accuracy
- Ensure stable internet connection
- Keep extension tab active for best performance

### 10. Getting Help

If you encounter issues:
1. Check the console logs for specific error messages
2. Verify API keys are valid and have remaining credits
3. Ensure microphone permissions are granted
4. Try reloading the extension
5. Review the TROUBLESHOOTING.md file for detailed solutions
