const axios = require('axios');
const config = require('../config');

class DeepSeekClient {
  constructor() {
    this.apiKey = config.deepseek.apiKey;
    this.model = config.deepseek.model;
    this.baseURL = config.deepseek.baseURL;
  }

  async chat(messages, options = {}) {
    const { data } = await axios.post(`${this.baseURL}/chat/completions`, {
      model: this.model,
      messages,
      temperature: options.temperature ?? config.deepseek.temperature,
      max_tokens: options.maxTokens ?? config.deepseek.maxTokens,
      stream: false,
    }, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    return data.choices[0].message.content;
  }

  async chatStream(messages, onChunk, options = {}) {
    const response = await axios.post(`${this.baseURL}/chat/completions`, {
      model: this.model,
      messages,
      temperature: options.temperature ?? config.deepseek.temperature,
      max_tokens: options.maxTokens ?? config.deepseek.maxTokens,
      stream: true,
    }, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      responseType: 'stream',
    });

    const stream = response.data;
    let buffer = '';

    for await (const chunk of stream) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const payload = trimmed.slice(6).trim();
        if (payload === '[DONE]') return;
        try {
          const parsed = JSON.parse(payload);
          const content = parsed.choices?.[0]?.delta?.content || '';
          if (content) onChunk(content);
        } catch { /* skip malformed chunks */ }
      }
    }
  }
}

module.exports = DeepSeekClient;
