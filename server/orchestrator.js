const ResearchAgent = require('./agents/research');
const OutlineAgent = require('./agents/outline');
const WriterAgent = require('./agents/writer');
const ReviewAgent = require('./agents/reviewer');

class Orchestrator {
  constructor(deepseekClient) {
    this.research = new ResearchAgent(deepseekClient);
    this.outline = new OutlineAgent(deepseekClient);
    this.writer = new WriterAgent(deepseekClient);
    this.reviewer = new ReviewAgent(deepseekClient);
  }

  async generate(topic, docType, onEvent) {
    const emit = (type, data) => onEvent && onEvent({ type, ...data });

    // Phase 1: Research
    emit('phase', { phase: 'research', message: 'Researching topic...' });
    const research = await this.research.execute(topic, docType);
    emit('phase', { phase: 'research', message: 'Research complete', data: { keyPoints: research.keyPoints?.length || 0 } });

    // Phase 2: Outline
    emit('phase', { phase: 'outline', message: 'Creating document structure...' });
    const outline = await this.outline.execute(topic, docType, research);
    emit('phase', { phase: 'outline', message: 'Outline ready', data: { sections: outline.length } });

    // Phase 3: Write
    emit('phase', { phase: 'writer', message: 'Writing document...' });
    const document = await this.writer.execute(topic, docType, research, outline);
    emit('phase', { phase: 'writer', message: 'First draft complete', data: { length: document.length } });

    // Phase 4: Review
    emit('phase', { phase: 'reviewer', message: 'Reviewing and improving...' });
    const review = await this.reviewer.execute(topic, docType, document);
    emit('phase', {
      phase: 'reviewer',
      message: 'Review complete',
      data: { score: review.overallScore, issues: review.issues?.length || 0 },
    });

    const finalDoc = review.improvedDocument || document;

    return {
      topic,
      docType,
      research,
      outline,
      draft: document,
      review,
      finalDocument: finalDoc,
    };
  }
}

module.exports = Orchestrator;
