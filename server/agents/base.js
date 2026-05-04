class BaseAgent {
  constructor(name, client) {
    this.name = name;
    this.client = client;
  }

  get systemPrompt() { return ''; }

  async execute(input, options = {}) {
    try {
      return await this.client.chat([
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: input },
      ], { maxTokens: options.maxTokens ?? 4096 });
    } catch (err) {
      throw new Error(`${this.name} agent failed: ${err.message}`);
    }
  }
}

module.exports = BaseAgent;
