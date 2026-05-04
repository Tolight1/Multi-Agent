const BaseAgent = require('./base');

const OUTLINE_PROMPT = `You are a document structure specialist. Create a detailed, well-organized outline.

Your response must be a JSON array of section objects, each with:
- "title": Section title
- "level": Heading level (1, 2, 3)
- "description": What this section should cover (2-3 sentences)
- "estimatedLength": "short" | "medium" | "long"

Create 5-10 sections at appropriate hierarchy levels. Ensure logical flow between sections.`;

class OutlineAgent extends BaseAgent {
  constructor(client) {
    super('Outline', client);
  }

  get systemPrompt() { return OUTLINE_PROMPT; }

  async execute(topic, docType, research) {
    const input = `Topic: ${topic}\nDocument Type: ${docType}\n\nResearch Summary: ${research.summary}\n\nKey Points: ${(research.keyPoints || []).join('\n')}\n\nCreate a detailed document outline as JSON array.`;
    const result = await super.execute(input);
    const jsonMatch = result.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, result];
    try {
      return JSON.parse(jsonMatch[1].trim());
    } catch {
      return [{ title: 'Introduction', level: 1, description: 'Overview', estimatedLength: 'medium' }];
    }
  }
}

module.exports = OutlineAgent;
