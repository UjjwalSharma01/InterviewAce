#!/bin/bash

# Interview Buddy Extension Setup and Test Script

echo "🚀 Interview Buddy Extension Setup"
echo "=================================="

# Check if we're in the right directory
if [ ! -f "manifest.json" ]; then
    echo "❌ Error: manifest.json not found in current directory"
    echo "💡 Please run this script from the extension root directory"
    exit 1
fi

echo "✅ Found manifest.json"

# Check if required files exist
echo ""
echo "📁 Checking file structure..."

required_files=(
    "manifest.json"
    "src/background/service-worker.js"
    "src/background/api-manager.js"
    "src/background/audio-processor.js"
    "src/content/content-script.js"
    "src/content/audio-capture.js"
    "src/popup/popup.html"
    "src/popup/popup.js"
    "src/assets/styles/floating-window.css"
    "icon16.png"
    "icon48.png"
    "icon128.png"
)

missing_files=()

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file (missing)"
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -gt 0 ]; then
    echo ""
    echo "⚠️  Missing files detected. The extension may not work properly."
    echo "Missing files:"
    for file in "${missing_files[@]}"; do
        echo "  - $file"
    done
else
    echo ""
    echo "✅ All required files present!"
fi

# Validate manifest.json
echo ""
echo "📋 Validating manifest.json..."

if command -v jq &> /dev/null; then
    if jq empty manifest.json 2>/dev/null; then
        echo "✅ manifest.json is valid JSON"
        
        # Check manifest version
        manifest_version=$(jq -r '.manifest_version' manifest.json)
        echo "📦 Manifest version: $manifest_version"
        
        # Check extension name
        ext_name=$(jq -r '.name' manifest.json)
        echo "📛 Extension name: $ext_name"
        
        # Check service worker
        service_worker=$(jq -r '.background.service_worker' manifest.json)
        echo "⚙️  Service worker: $service_worker"
        
    else
        echo "❌ manifest.json contains invalid JSON"
    fi
else
    echo "⚠️  jq not available - skipping JSON validation"
    echo "💡 Install jq with: sudo apt install jq"
fi

# Check if Chrome/Chromium is available
echo ""
echo "🌐 Checking browser availability..."

if command -v google-chrome &> /dev/null; then
    echo "✅ Google Chrome found"
    BROWSER="google-chrome"
elif command -v chromium-browser &> /dev/null; then
    echo "✅ Chromium browser found"
    BROWSER="chromium-browser"
elif command -v chromium &> /dev/null; then
    echo "✅ Chromium found"
    BROWSER="chromium"
else
    echo "❌ No supported browser found"
    echo "💡 Please install Google Chrome or Chromium"
    BROWSER=""
fi

# Provide setup instructions
echo ""
echo "📖 Setup Instructions:"
echo "====================="
echo ""
echo "1. Open Chrome and navigate to: chrome://extensions/"
echo "2. Enable 'Developer mode' (toggle in top-right)"
echo "3. Click 'Load unpacked' button"
echo "4. Select this directory: $(pwd)"
echo "5. The extension should load successfully"
echo ""
echo "🔧 Configuration:"
echo "=================="
echo ""
echo "After loading the extension:"
echo "1. Click the Interview Buddy icon in Chrome toolbar"
echo "2. Go to 'API Keys' tab"
echo "3. Configure your API keys:"
echo "   - AssemblyAI: Required for transcription"
echo "   - Gemini: Primary AI provider (recommended)"
echo "   - OpenAI/Anthropic: Optional backup providers"
echo ""
echo "🎯 Usage:"
echo "========="
echo ""
echo "1. Open a video call (Zoom, Google Meet, Teams)"
echo "2. Click the Interview Buddy icon"
echo "3. Click 'Launch Interview Assistant'"
echo "4. Grant microphone permissions"
echo "5. Start your interview!"
echo ""

# Offer to open browser
if [ -n "$BROWSER" ]; then
    echo "🚀 Quick Start:"
    echo "==============="
    echo ""
    read -p "Would you like to open Chrome extensions page? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Opening Chrome extensions page..."
        $BROWSER --new-tab chrome://extensions/ &
        sleep 2
        echo "💡 Now click 'Load unpacked' and select: $(pwd)"
    fi
fi

echo ""
echo "📚 Additional Resources:"
echo "======================="
echo ""
echo "• Troubleshooting guide: ./TROUBLESHOOTING.md"
echo "• Test script: ./test-extension.js"
echo "• Extension features:"
echo "  - Real-time transcription with AssemblyAI"
echo "  - AI responses with Gemini 2.5 Flash"
echo "  - Improved speaker detection"
echo "  - Enhanced question recognition"
echo "  - Screen sharing invisibility"
echo ""
echo "🎉 Setup complete! The extension should now work properly."
echo "🐛 If you encounter issues, check the troubleshooting guide."
