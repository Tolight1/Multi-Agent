const BaseAgent = require('./base');

const WRITER_PROMPT = `You are a professional document writer. Write clear, well-structured, authoritative content.

Write in a professional tone appropriate for the document type. Use markdown formatting:
- # Heading 1 for main title
- ## Heading 2 for sections
- ### Heading 3 for subsections
- Bullet points and numbered lists where appropriate
- Bold for key terms
- Code blocks for technical content

Be thorough but concise. Each section should be substantive. Write in Chinese or English as appropriate for the topic.`;

class WriterAgent extends BaseAgent {
  constructor(client) {
    super('Writer', client);
  }

  get systemPrompt() { return WRITER_PROMPT; }

  async execute(topic, docType, research, outline) {
    const outlineStr = outline.map(s =>
      `${'  '.repeat((s.level || 1) - 1)}${'#'.repeat(s.level || 1)} ${s.title}\n${s.description}`
    ).join('\n\n');

    const input = `Topic: ${topic}\nDocument Type: ${docType}\n\nResearch Context:\n${research.summary}\n\nOutline:\n${outlineStr}\n\nWrite the complete document in markdown format.`;
    return await super.execute(input, { maxTokens: 8192 });
  }
}

module.exports = WriterAgent;
