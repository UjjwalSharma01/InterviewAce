// Settings module for Interview Buddy extension
class Settings {
  constructor() {
    this.settings = {
      darkMode: true,
      lowContrast: false,
      fontSize: {
        questions: 16,
        responses: 16
      },
      activeProvider: 'gemini', // Default to Gemini 2.5 Flash
      windowPosition: { x: 20, y: 20 },
      windowSize: { width: 400, height: 500 }
    };
    
    // API keys
    this.apiKeys = {
      openai: null,
      anthropic: null,
      gemini: null,
      assemblyai: null
    };
    
    // Load settings on initialization
    this.loadSettings();
  }
  
  // Load settings from storage
  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get([
        'darkMode',
        'lowContrast',
        'fontSize',
        'activeProvider',
        'windowPosition',
        'windowSize',
        'apiKeys'
      ], (result) => {
        // Update settings with stored values
        if (result.darkMode !== undefined) this.settings.darkMode = result.darkMode;
        if (result.lowContrast !== undefined) this.settings.lowContrast = result.lowContrast;
        if (result.fontSize) this.settings.fontSize = result.fontSize;
        if (result.activeProvider) this.settings.activeProvider = result.activeProvider;
        if (result.windowPosition) this.settings.windowPosition = result.windowPosition;
        if (result.windowSize) this.settings.windowSize = result.windowSize;
        
        // Update API keys
        if (result.apiKeys) {
          this.apiKeys = {...this.apiKeys, ...result.apiKeys};
        }
        
        resolve(this.settings);
      });
    });
  }
  
  // Save settings to storage
  async saveSettings(settings = null) {
    const updatedSettings = settings || this.settings;
    
    return new Promise((resolve) => {
      chrome.storage.local.set(updatedSettings, () => {
        // Update local settings
        if (settings) {
          this.settings = {...this.settings, ...settings};
        }
        
        resolve(true);
      });
    });
  }
  
  // Get a specific setting
  getSetting(key) {
    return this.settings[key];
  }
  
  // Set a specific setting
  async setSetting(key, value) {
    this.settings[key] = value;
    
    // Save to storage
    const settingObject = {};
    settingObject[key] = value;
    return await this.saveSettings(settingObject);
  }
  
  // Get all settings
  getAllSettings() {
    return {...this.settings};
  }
  
  // Get API key for a provider
  getApiKey(provider) {
    return this.apiKeys[provider];
  }
  
  // Set API key for a provider
  async setApiKey(provider, key) {
    // Update local copy
    this.apiKeys[provider] = key;
    
    // Save to storage
    return new Promise((resolve) => {
      chrome.storage.local.set({ apiKeys: this.apiKeys }, () => {
        resolve(true);
      });
    });
  }
  
  // Check if required API keys are set
  hasRequiredApiKeys() {
    // Need AssemblyAI for transcription
    if (!this.apiKeys.assemblyai) {
      return false;
    }
    
    // Need at least one AI provider
    return !!(this.apiKeys.openai || this.apiKeys.anthropic || this.apiKeys.gemini);
  }
  
  // Get active provider
  getActiveProvider() {
    return this.settings.activeProvider;
  }
  
  // Set active provider
  async setActiveProvider(provider) {
    if (!['openai', 'anthropic', 'gemini'].includes(provider)) {
      throw new Error('Invalid provider');
    }
    
    await this.setSetting('activeProvider', provider);
    return true;
  }
  
  // Reset settings to defaults
  async resetToDefaults() {
    this.settings = {
      darkMode: true,
      lowContrast: false,
      fontSize: {
        questions: 16,
        responses: 16
      },
      activeProvider: 'gemini', // Default to Gemini 2.5 Flash
      windowPosition: { x: 20, y: 20 },
      windowSize: { width: 400, height: 500 }
    };
    
    return await this.saveSettings();
  }
}

export default Settings;
