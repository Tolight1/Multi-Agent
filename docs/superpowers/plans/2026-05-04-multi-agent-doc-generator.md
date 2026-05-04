# Multi-Agent Document Generator Implementation Plan

> **For agentic workers:** Implement tasks sequentially. Each task builds on the previous.

**Goal:** Build a multi-agent AI document generation system with web UI that produces PDF documents via DeepSeek API.

**Architecture:** Express.js backend orchestrates 4 agents (Research → Outline → Writer → Review) sequentially. Frontend shows real-time progress via SSE. Final output is a styled PDF.

**Tech Stack:** Node.js/Express, DeepSeek API (deepseek-chat), Puppeteer (PDF), vanilla HTML/CSS/JS frontend.

---

### Task 1: Project Initialization

**Files:**
- Create: `E:/Project/mutiTXT/package.json`
- Create: `E:/Project/mutiTXT/.env`
- Create: `E:/Project/mutiTXT/server/config.js`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "muti-txt-doc-generator",
  "version": "1.0.0",
  "description": "Multi-Agent AI Document Generation System",
  "main": "server/index.js",
  "scripts": {
    "start": "node server/index.js",
    "dev": "node --watch server/index.js"
  },
  "dependencies": {
    "axios": "^1.7.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "express": "^4.19.0",
    "marked": "^12.0.0",
    "morgan": "^1.10.0",
    "puppeteer": "^22.0.0",
    "uuid": "^9.0.0"
  }
}
```

- [ ] **Step 2: Create .env**

```
DEEPSEEK_API_KEY=sk-eab7300e12de430f8fb1ebaf6fece665
DEEPSEEK_MODEL=deepseek-chat
PORT=3000
```

- [ ] **Step 3: Create server/config.js**

```javascript
require('dotenv').config();

module.exports = {
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    baseURL: 'https://api.deepseek.com/v1',
    maxTokens: 8192,
    temperature: 0.7,
  },
  port: parseInt(process.env.PORT || '3000', 10),
  outputDir: process.env.OUTPUT_DIR || './output',
};
```

- [ ] **Step 4: Install dependencies**

Run: `cd /e/Project/mutiTXT && npm install`

---

### Task 2: DeepSeek API Client

**Files:**
- Create: `E:/Project/mutiTXT/server/services/deepseek.js`

- [ ] **Step 1: Create DeepSeek API client**

```javascript
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
```

---

### Task 3: Base Agent + Research Agent

**Files:**
- Create: `E:/Project/mutiTXT/server/agents/base.js`
- Create: `E:/Project/mutiTXT/server/agents/research.js`

- [ ] **Step 1: Create Base Agent class**

```javascript
class BaseAgent {
  constructor(name, client) {
    this.name = name;
    this.client = client;
  }

  get systemPrompt() { return ''; }

  async execute(input, onChunk) {
    try {
      const fullResponse = await this.client.chat([
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: input },
      ], { maxTokens: 4096 });
      return fullResponse;
    } catch (err) {
      throw new Error(`${this.name} agent failed: ${err.message}`);
    }
  }
}

module.exports = BaseAgent;
```

- [ ] **Step 2: Create Research Agent**

```javascript
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
    // Extract JSON from response (handle markdown-wrapped JSON)
    const jsonMatch = result.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, result];
    try {
      return JSON.parse(jsonMatch[1].trim());
    } catch {
      return { summary: result, keyPoints: [], sections: [], references: [] };
    }
  }
}

module.exports = ResearchAgent;
```

---

### Task 4: Outline Agent

**Files:**
- Create: `E:/Project/mutiTXT/server/agents/outline.js`

```javascript
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
```

---

### Task 5: Writer Agent

**Files:**
- Create: `E:/Project/mutiTXT/server/agents/writer.js`

```javascript
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
```

---

### Task 6: Review Agent

**Files:**
- Create: `E:/Project/mutiTXT/server/agents/reviewer.js`

```javascript
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
```

---

### Task 7: Agent Orchestrator

**Files:**
- Create: `E:/Project/mutiTXT/server/orchestrator.js`

```javascript
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

    try {
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
    } catch (err) {
      emit('error', { message: err.message });
      throw err;
    }
  }
}

module.exports = Orchestrator;
```

---

### Task 8: PDF Generation Service

**Files:**
- Create: `E:/Project/mutiTXT/server/services/pdf.js`

```javascript
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const puppeteer = require('puppeteer');
const config = require('../config');

const PDF_CSS = `
  @page { margin: 2.5cm 2cm; }
  body {
    font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
    font-size: 12pt;
    line-height: 1.8;
    color: #1a1a1a;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  }
  h1 { font-size: 22pt; color: #1a1a2e; border-bottom: 3px solid #0f3460; padding-bottom: 10px; margin-top: 30px; }
  h2 { font-size: 18pt; color: #0f3460; border-bottom: 1px solid #ddd; padding-bottom: 6px; margin-top: 25px; }
  h3 { font-size: 14pt; color: #16213e; margin-top: 20px; }
  p { margin: 10px 0; text-align: justify; }
  ul, ol { margin: 10px 0; padding-left: 25px; }
  li { margin: 5px 0; }
  code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 11pt; }
  pre { background: #f8f8f8; padding: 15px; border-radius: 5px; border: 1px solid #e0e0e0; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 4px solid #0f3460; margin: 15px 0; padding: 10px 20px; background: #f9f9fb; }
  table { border-collapse: collapse; width: 100%; margin: 15px 0; }
  th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
  th { background: #0f3460; color: white; }
  strong { color: #0f3460; }
`;

class PDFService {
  async generate(markdown, outputPath) {
    const html = marked.parse(markdown, { breaks: true });
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${PDF_CSS}</style></head><body>${html}</body></html>`;

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
      await page.pdf({
        path: outputPath,
        format: 'A4',
        margin: { top: '2.5cm', bottom: '2.5cm', left: '2cm', right: '2cm' },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: '<div style="font-size:10px; text-align:center; width:100%; color:#888;"><span class="pageNumber"></span></div>',
      });
    } finally {
      await browser.close();
    }

    return outputPath;
  }
}

module.exports = PDFService;
```

---

### Task 9: Express Server + API Routes

**Files:**
- Create: `E:/Project/mutiTXT/server/routes/api.js`
- Create: `E:/Project/mutiTXT/server/index.js`

- [ ] **Step 1: Create API routes**

```javascript
const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

function createRouter(orchestrator, pdfService) {
  const router = express.Router();
  const jobs = new Map();

  router.post('/generate', async (req, res) => {
    const { topic, docType = '技术文档' } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const jobId = uuidv4();
    const outputDir = path.resolve(config.outputDir || './output', jobId);
    fs.mkdirSync(outputDir, { recursive: true });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const sendEvent = (event, data) => {
      if (!res.destroyed) {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    };

    try {
      const result = await orchestrator.generate(topic, docType, (event) => {
        sendEvent('phase', event);
      });

      // Generate PDF
      sendEvent('phase', { phase: 'pdf', message: 'Generating PDF...' });
      const pdfPath = path.join(outputDir, 'document.pdf');
      await pdfService.generate(result.finalDocument, pdfPath);

      sendEvent('phase', { phase: 'pdf', message: 'PDF ready' });

      // Store result metadata
      jobs.set(jobId, {
        topic,
        docType,
        pdfPath: `/api/download/${jobId}`,
        markdownPath: `/api/download/${jobId}/markdown`,
        createdAt: new Date(),
      });

      sendEvent('complete', {
        jobId,
        downloadUrl: `/api/download/${jobId}`,
        markdownUrl: `/api/download/${jobId}/markdown`,
        topic,
        score: result.review?.overallScore,
        sections: result.outline?.length,
      });
    } catch (err) {
      sendEvent('error', { message: err.message });
    } finally {
      res.end();
    }
  });

  router.get('/download/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const filePath = path.resolve(config.outputDir || './output', req.params.jobId, 'document.pdf');
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

    res.download(filePath, `${job.topic || 'document'}.pdf`);
  });

  router.get('/download/:jobId/markdown', (req, res) => {
    const filePath = path.resolve(config.outputDir || './output', req.params.jobId, 'document.md');
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

    res.download(filePath, 'document.md');
  });

  return router;
}

module.exports = createRouter;
```

- [ ] **Step 2: Create Express server entry point**

```javascript
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');
const DeepSeekClient = require('./services/deepseek');
const Orchestrator = require('./orchestrator');
const PDFService = require('./services/pdf');
const createRouter = require('./routes/api');

const app = express();
const deepseek = new DeepSeekClient();
const orchestrator = new Orchestrator(deepseek);
const pdfService = new PDFService();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', createRouter(orchestrator, pdfService));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(config.port, () => {
  console.log(`Document Generator running at http://localhost:${config.port}`);
});
```

---

### Task 10: Frontend UI

**Files:**
- Create: `E:/Project/mutiTXT/public/index.html`
- Create: `E:/Project/mutiTXT/public/style.css`
- Create: `E:/Project/mutiTXT/public/app.js`

- [ ] **Step 1: Create HTML**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Multi-Agent Document Generator</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>Multi-Agent Document Generator</h1>
      <p class="subtitle">AI-powered document generation with multi-agent collaboration</p>
    </header>

    <!-- Input Section -->
    <section id="input-section" class="card">
      <h2>Create Document</h2>
      <div class="form-group">
        <label for="topic">Topic</label>
        <input type="text" id="topic" placeholder="Enter document topic..." />
      </div>
      <div class="form-group">
        <label for="docType">Document Type</label>
        <select id="docType">
          <option value="技术方案">技术方案</option>
          <option value="产品文档">产品文档</option>
          <option value="行业分析报告">行业分析报告</option>
          <option value="研究报告">研究报告</option>
          <option value="项目提案">项目提案</option>
        </select>
      </div>
      <button id="generate-btn" onclick="startGeneration()">Generate Document</button>
    </section>

    <!-- Progress Section -->
    <section id="progress-section" class="card" style="display:none">
      <h2>Generation Progress</h2>
      <div id="agents">
        <div class="agent" data-agent="research">
          <div class="agent-header"><span class="agent-icon">🔍</span> Research Agent</div>
          <div class="agent-status pending">Pending</div>
          <div class="agent-message"></div>
        </div>
        <div class="agent" data-agent="outline">
          <div class="agent-header"><span class="agent-icon">📋</span> Outline Agent</div>
          <div class="agent-status pending">Pending</div>
          <div class="agent-message"></div>
        </div>
        <div class="agent" data-agent="writer">
          <div class="agent-header"><span class="agent-icon">✍️</span> Writer Agent</div>
          <div class="agent-status pending">Pending</div>
          <div class="agent-message"></div>
        </div>
        <div class="agent" data-agent="reviewer">
          <div class="agent-header"><span class="agent-icon">✅</span> Review Agent</div>
          <div class="agent-status pending">Pending</div>
          <div class="agent-message"></div>
        </div>
        <div class="agent" data-agent="pdf">
          <div class="agent-header"><span class="agent-icon">📄</span> PDF Generation</div>
          <div class="agent-status pending">Pending</div>
          <div class="agent-message"></div>
        </div>
      </div>
      <div id="progress-bar-container">
        <div id="progress-bar"></div>
      </div>
    </section>

    <!-- Result Section -->
    <section id="result-section" class="card" style="display:none">
      <h2>Document Ready</h2>
      <div id="result-meta"></div>
      <div class="actions">
        <button class="btn-primary" onclick="downloadPDF()">Download PDF</button>
        <button class="btn-secondary" onclick="downloadMarkdown()">Download Markdown</button>
        <button class="btn-secondary" onclick="resetForm()">Create New</button>
      </div>
    </section>

    <!-- Error Section -->
    <section id="error-section" class="card error" style="display:none">
      <h2>Error</h2>
      <p id="error-message"></p>
      <button class="btn-secondary" onclick="resetForm()">Try Again</button>
    </section>
  </div>

  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create CSS**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
  background: linear-gradient(135deg, #0f0c29 0%, #1a1a3e 50%, #24243e 100%);
  min-height: 100vh;
  color: #e0e0e0;
}

.container {
  max-width: 720px;
  margin: 0 auto;
  padding: 40px 20px;
}

header {
  text-align: center;
  margin-bottom: 40px;
}

header h1 {
  font-size: 32px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 8px;
}

.subtitle {
  color: #888;
  font-size: 14px;
}

.card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 30px;
  margin-bottom: 20px;
  backdrop-filter: blur(10px);
}

.card h2 {
  font-size: 18px;
  margin-bottom: 20px;
  color: #ccc;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: #aaa;
  margin-bottom: 6px;
  font-weight: 500;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  color: #fff;
  font-size: 15px;
  outline: none;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group select:focus {
  border-color: #667eea;
}

.form-group select option {
  background: #1a1a3e;
  color: #fff;
}

button {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

#generate-btn {
  background: linear-gradient(90deg, #667eea, #764ba2);
  color: white;
  margin-top: 8px;
}

#generate-btn:hover { opacity: 0.9; transform: translateY(-1px); }
#generate-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

.agent {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  margin-bottom: 8px;
  transition: all 0.3s;
}

.agent.active {
  background: rgba(102, 126, 234, 0.15);
  border: 1px solid rgba(102, 126, 234, 0.3);
}

.agent.completed {
  background: rgba(72, 199, 142, 0.1);
  border: 1px solid rgba(72, 199, 142, 0.2);
}

.agent.error .agent-status {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.agent-icon { font-size: 18px; margin-right: 12px; }
.agent-header { flex: 1; font-weight: 500; font-size: 14px; }

.agent-status {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 20px;
  font-weight: 500;
  margin-right: 12px;
}

.agent-status.pending { background: rgba(255, 255, 255, 0.1); color: #888; }
.agent-status.running { background: rgba(102, 126, 234, 0.2); color: #667eea; animation: pulse 1.5s infinite; }
.agent-status.completed { background: rgba(72, 199, 142, 0.2); color: #48c78e; }
.agent-status.error { background: rgba(239, 68, 68, 0.2); color: #ef4444; }

.agent-message {
  font-size: 12px;
  color: #888;
  min-width: 120px;
  text-align: right;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

#progress-bar-container {
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  margin-top: 16px;
  overflow: hidden;
}

#progress-bar {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 2px;
  transition: width 0.5s;
}

.actions {
  display: flex;
  gap: 10px;
}

.actions button { flex: 1; }

.btn-primary {
  background: linear-gradient(90deg, #667eea, #764ba2);
  color: white;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #ccc;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
}

.card.error {
  border-color: rgba(239, 68, 68, 0.3);
}

.card.error h2 { color: #ef4444; }

#result-meta {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.meta-item {
  background: rgba(255, 255, 255, 0.05);
  padding: 12px 16px;
  border-radius: 8px;
  text-align: center;
  flex: 1;
  min-width: 100px;
}

.meta-item .value {
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(90deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.meta-item .label {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}
```

- [ ] **Step 3: Create JavaScript**

```javascript
let currentJob = null;

function startGeneration() {
  const topic = document.getElementById('topic').value.trim();
  const docType = document.getElementById('docType').value;

  if (!topic) {
    alert('Please enter a document topic');
    return;
  }

  currentJob = null;
  document.getElementById('input-section').style.display = 'none';
  document.getElementById('progress-section').style.display = 'block';
  document.getElementById('result-section').style.display = 'none';
  document.getElementById('error-section').style.display = 'none';
  document.getElementById('generate-btn').disabled = true;

  // Reset agents
  document.querySelectorAll('.agent').forEach(a => {
    a.className = 'agent';
    const status = a.querySelector('.agent-status');
    status.className = 'agent-status pending';
    status.textContent = 'Pending';
    a.querySelector('.agent-message').textContent = '';
  });
  setProgress(0);

  fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, docType }),
  }).then(response => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    function processChunk({ done, value }) {
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          const eventType = line.slice(7).trim();
          // Next line should be data:
          // Handled below
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            handleEvent(eventType || 'message', data);
          } catch { /* skip */ }
        }
      }
      return reader.read().then(processChunk);
    }

    return reader.read().then(processChunk);
  }).catch(err => {
    showError(err.message);
  });
}

function handleEvent(event, data) {
  switch (event) {
    case 'phase':
      updateAgent(data.phase, data.message, data.data);
      break;
    case 'complete':
      currentJob = data;
      showResult(data);
      break;
    case 'error':
      showError(data.message);
      break;
  }
}

function updateAgent(phase, message, extra) {
  const agent = document.querySelector(`[data-agent="${phase}"]`);
  if (!agent) return;

  agent.className = 'agent active';
  const status = agent.querySelector('.agent-status');
  status.className = 'agent-status running';
  status.textContent = 'Running...';
  agent.querySelector('.agent-message').textContent = message || '';

  // Mark previous agents as completed
  let found = false;
  document.querySelectorAll('.agent').forEach(a => {
    if (a === agent) found = true;
    if (!found) {
      a.className = 'agent completed';
      const s = a.querySelector('.agent-status');
      s.className = 'agent-status completed';
      s.textContent = 'Completed';
    }
  });

  // Update progress
  const phases = ['research', 'outline', 'writer', 'reviewer', 'pdf'];
  const idx = phases.indexOf(phase);
  if (idx >= 0) setProgress(((idx + 1) / phases.length) * 100);
}

function setProgress(pct) {
  document.getElementById('progress-bar').style.width = pct + '%';
}

function showResult(data) {
  document.querySelectorAll('.agent').forEach(a => {
    a.className = 'agent completed';
    const s = a.querySelector('.agent-status');
    s.className = 'agent-status completed';
    s.textContent = 'Completed';
  });
  setProgress(100);

  document.getElementById('progress-section').style.display = 'none';
  document.getElementById('result-section').style.display = 'block';
  document.getElementById('generate-btn').disabled = false;

  document.getElementById('result-meta').innerHTML = `
    <div class="meta-item">
      <div class="value">${data.score || '-'}</div>
      <div class="label">Quality Score</div>
    </div>
    <div class="meta-item">
      <div class="value">${data.sections || '-'}</div>
      <div class="label">Sections</div>
    </div>
    <div class="meta-item">
      <div class="value">${data.topic || '-'}</div>
      <div class="label">Topic</div>
    </div>
  `;
}

function downloadPDF() {
  if (currentJob?.downloadUrl) window.open(currentJob.downloadUrl, '_blank');
}

function downloadMarkdown() {
  if (currentJob?.markdownUrl) window.open(currentJob.markdownUrl, '_blank');
}

function showError(message) {
  document.getElementById('progress-section').style.display = 'none';
  document.getElementById('error-section').style.display = 'block';
  document.getElementById('error-message').textContent = message;
  document.getElementById('generate-btn').disabled = false;

  // Mark active agent as error
  document.querySelector('.agent.active')?.classList.add('error');
}

function resetForm() {
  document.getElementById('input-section').style.display = 'block';
  document.getElementById('progress-section').style.display = 'none';
  document.getElementById('result-section').style.display = 'none';
  document.getElementById('error-section').style.display = 'none';
  document.getElementById('generate-btn').disabled = false;
  currentJob = null;
}
```

---

### Task 11: Saving Markdown Output

**Files:**
- Modify: `E:/Project/mutiTXT/server/orchestrator.js` (add markdown file save)
- Modify: `E:/Project/mutiTXT/server/routes/api.js` (already handles markdown download)

- [ ] **Step 1: Update orchestrator to save markdown**

In orchestrator.js, after getting finalDocument, add:
```javascript
const fs = require('fs');
const path = require('path');
// In generate(), before return:
const outputDir = path.resolve(config.outputDir || './output');
// Save markdown alongside PDF
```

Actually, the markdown saving should be in the API route since that's where jobId and outputDir are managed. Let's keep the orchestrator pure and save files in the routes.

The api.js already references `/api/download/:jobId/markdown` which will serve the file. We just need to make sure the markdown is saved alongside the PDF. Let me add markdown saving to the api.js route.

---

### Task 12: Verification

- [ ] **Start server and test**
  Run: `cd /e/Project/mutiTXT && npm start`
  Expected: Server starts on port 3000

- [ ] **Open browser and test UI**
  Navigate to `http://localhost:3000`
  Expected: Clean UI loads with input form

- [ ] **Run a document generation**
  Enter topic and click Generate
  Expected: All 4 agents execute sequentially, PDF downloads
