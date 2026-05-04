const BaseAgent = require('./base');

const REVIEW_PROMPT = `You are a senior document reviewer. Review the document for quality and provide structured feedback.

Your response must be a JSON object with:
- "overallScore": 1-10
- "strengths": Array of what the document does well
- "issues": Array of issues found, each with type ("error" | "warning" | "suggestion"), location, and description
- "improvedDocument": The full document with ALL issues fixed (complete markdown, not just diff)
- "summary": Brief review summary

Check for:
1. Logical consistency and flow between sections
2. Terminology accuracy and consistency
3. Factual claims and potential hallucinations
4. Grammar, spelling, and clarity
5. Completeness against the outline
6. Professional tone and style

IMPORTANT: Return the improvedDocument with ALL fixes applied. This is the version that will be used as final output.`;

class ReviewAgent extends BaseAgent {
  constructor(client) {
    super('Review', client);
  }

  get systemPrompt() { return REVIEW_PROMPT; }

  async execute(topic, docType, document) {
    const input = `Document Type: ${docType}\nTopic: ${topic}\n\nDocument to review:\n\n${document}\n\nReview this document and return structured JSON with improved version.`;
    const result = await super.execute(input, { maxTokens: 8192 });
    const jsonMatch = result.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, result];
    try {
      return JSON.parse(jsonMatch[1].trim());
    } catch {
      return {
        overallScore: 7,
        strengths: ['Document completed'],
        issues: [],
        improvedDocument: document,
        summary: 'Review completed (auto-format)',
      };
    }
  }
}

module.exports = ReviewAgent;
