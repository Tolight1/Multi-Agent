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

    jobs.set(jobId, {
      topic,
      docType,
      outputDir,
      status: 'created',
      createdAt: new Date(),
    });

    res.json({ jobId });
  });

  router.get('/stream/:jobId', async (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).end();

    job.status = 'running';

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const sendEvent = (event, data) => {
      if (!res.destroyed) {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    };

    req.on('close', () => {
      job.status = 'cancelled';
    });

    try {
      const result = await orchestrator.generate(job.topic, job.docType, (event) => {
        sendEvent('phase', event);
      });

      if (job.status === 'cancelled') return res.end();

      // Save markdown
      const mdPath = path.join(job.outputDir, 'document.md');
      fs.writeFileSync(mdPath, result.finalDocument, 'utf-8');

      // Generate PDF
      sendEvent('phase', { phase: 'pdf', message: 'Generating PDF...' });
      const pdfPath = path.join(job.outputDir, 'document.pdf');
      await pdfService.generate(result.finalDocument, pdfPath);
      sendEvent('phase', { phase: 'pdf', message: 'PDF ready' });

      job.status = 'completed';

      sendEvent('complete', {
        jobId: req.params.jobId,
        downloadUrl: `/api/download/${req.params.jobId}`,
        markdownUrl: `/api/download/${req.params.jobId}/markdown`,
        topic: job.topic,
        score: result.review?.overallScore,
        sections: result.outline?.length,
      });
    } catch (err) {
      sendEvent('error', { message: err.message });
      job.status = 'error';
    } finally {
      res.end();
    }
  });

  router.get('/download/:jobId', (req, res) => {
    const filePath = path.resolve(config.outputDir || './output', req.params.jobId, 'document.pdf');
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.download(filePath, 'document.pdf');
  });

  router.get('/download/:jobId/markdown', (req, res) => {
    const filePath = path.resolve(config.outputDir || './output', req.params.jobId, 'document.md');
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.download(filePath, 'document.md');
  });

  router.get('/jobs', (req, res) => {
    const jobList = Array.from(jobs.entries()).map(([id, job]) => ({
      id, topic: job.topic, docType: job.docType, status: job.status, createdAt: job.createdAt,
    }));
    res.json(jobList);
  });

  return router;
}

module.exports = createRouter;
