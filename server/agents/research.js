const BaseAgent = require('./base');

const RESEARCH_PROMPT = `You are a professional research analyst. Given a document topic and type, produce comprehensive research data.

Your response must be a structured JSON object with these fields:
- "summary": A 2-3 paragraph overview of the topic (markdown format)
- "keyPoints": Array of 5-10 key points about the topic
- "sections": Array of suggested content sections, each with a title and brief description
- "references": Any relevant reference information

Be thorough and factual. Focus on the most important and relevant information only.`;

class ResearchAgent extends BaseAgent {
  constructor(client) {
    super('Research', client);
  }

  get systemPrompt() { return RESEARCH_PROMPT; }

  async execute(topic, docType) {
    const input = `Topic: ${topic}\nDocument Type: ${docType}\n\nResearch the above topic thoroughly and return structured JSON.`;
    const result = await super.execute(input);
    const jsonMatch = result.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, result];
    try {
      return JSON.parse(jsonMatch[1].trim());
    } catch {
      return { summary: result, keyPoints: [], sections: [], references: [] };
    }
  }
}

module.exports = ResearchAgent;
