// API manager for handling different AI providers
class ApiManager {
  constructor() {
    this.providers = {
      gemini: {
        name: 'Gemini 2.5 Flash',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        model: 'gemini-2.5-flash',
        maxTokens: 8192,
        temperature: 0.7
      },
      openai: {
        name: 'OpenAI GPT-4',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4-turbo',
        maxTokens: 4096,
        temperature: 0.7
      },
      anthropic: {
        name: 'Claude 3.5',
        baseUrl: 'https://api.anthropic.com/v1',
        model: 'claude-3-5-sonnet',
        maxTokens: 4096,
        temperature: 0.7
      }
    };
    
    this.apiKeys = {};
    this.activeProvider = 'gemini'; // Set Gemini as default
    this.loadApiKeys();
  }
  
  // Load API keys from storage
  async loadApiKeys() {
    try {
      const data = await chrome.storage.local.get(['apiKeys', 'activeProvider']);
      if (data.apiKeys) {
        this.apiKeys = data.apiKeys;
      }
      if (data.activeProvider) {
        this.activeProvider = data.activeProvider;
      }
    } catch (error) {
      console.error('Error loading API keys:', error);
    }
  }
  
  // Save API keys to storage
  async saveApiKey(provider, key) {
    try {
      this.apiKeys[provider] = key;
      await chrome.storage.local.set({ apiKeys: this.apiKeys });
      return true;
    } catch (error) {
      console.error('Error saving API key:', error);
      return false;
    }
  }
  
  // Set active provider
  async setActiveProvider(provider) {
    if (!this.providers[provider]) {
      throw new Error(`Provider ${provider} not supported`);
    }
    
    this.activeProvider = provider;
    await chrome.storage.local.set({ activeProvider: provider });
  }
  
  // Get available providers
  getProviders() {
    return Object.entries(this.providers).map(([id, config]) => ({
      id,
      name: config.name
    }));
  }
  
  // Get provider configuration
  getProviderConfig(provider = null) {
    const providerKey = provider || this.activeProvider;
    return this.providers[providerKey];
  }
  
  // Generate a response using the current provider
  async generateResponse(messages, provider = null) {
    const providerKey = provider || this.activeProvider;
    const config = this.providers[providerKey];
    const apiKey = this.apiKeys[providerKey];
    
    if (!apiKey) {
      throw new Error(`API key not set for ${config.name}`);
    }
    
    try {
      switch (providerKey) {
        case 'openai':
          return await this.callOpenAI(messages, apiKey, config);
        case 'anthropic':
          return await this.callAnthropic(messages, apiKey, config);
        case 'gemini':
          return await this.callGemini(messages, apiKey, config);
        default:
          throw new Error(`Provider ${providerKey} not supported`);
      }
    } catch (error) {
      console.error(`Error calling ${config.name} API:`, error);
      throw error;
    }
  }
  
  // Call OpenAI API
  async callOpenAI(messages, apiKey, config) {
    const formattedMessages = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));
    
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: formattedMessages,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        stream: true
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Error calling OpenAI API');
    }
    
    return response;
  }
  
  // Call Anthropic API
  async callAnthropic(messages, apiKey, config) {
    // Convert messages to Anthropic format
    const formattedMessages = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));
    
    const response = await fetch(`${config.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.model,
        messages: formattedMessages,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        stream: true
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Error calling Anthropic API');
    }
    
    return response;
  }
  
  // Call Gemini API
  async callGemini(messages, apiKey, config) {
    // Convert messages to Gemini format
    const formattedMessages = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));
    
    const response = await fetch(
      `${config.baseUrl}/models/${config.model}:streamGenerateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: formattedMessages,
          generationConfig: {
            maxOutputTokens: config.maxTokens,
            temperature: config.temperature
          }
        })
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Error calling Gemini API');
    }
    
    return response;
  }
  
  // Stream processing utility method
  async processStream(response, provider, callback) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let buffer = '';
    
    try {
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        
        if (done) break;
        
        const chunk = decoder.decode(value);
        
        // Handle different streaming formats based on provider
        switch (provider) {
          case 'openai':
            buffer += chunk;
            // Process OpenAI SSE format
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                try {
                  const data = JSON.parse(line.substring(6));
                  const content = data.choices[0]?.delta?.content || '';
                  if (content) {
                    callback(content);
                  }
                } catch (e) {
                  console.error('Error parsing OpenAI stream:', e);
                }
              }
            }
            break;
            
          case 'anthropic':
            buffer += chunk;
            // Process Anthropic SSE format
            const anthropicLines = buffer.split('\n');
            buffer = anthropicLines.pop() || '';
            
            for (const line of anthropicLines) {
              if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                try {
                  const data = JSON.parse(line.substring(6));
                  const content = data.delta?.text || '';
                  if (content) {
                    callback(content);
                  }
                } catch (e) {
                  console.error('Error parsing Anthropic stream:', e);
                }
              }
            }
            break;
            
          case 'gemini':
            // Process Gemini response format
            try {
              const data = JSON.parse(chunk);
              const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (content) {
                callback(content);
              }
            } catch (e) {
              console.error('Error parsing Gemini response:', e);
            }
            break;
        }
      }
    } catch (error) {
      console.error('Error processing stream:', error);
      throw error;
    } finally {
      reader.releaseLock();
    }
  }
}

// Export the ApiManager
export default ApiManager;
