let currentJob = null;
let eventStream = null;

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
    if (!response.ok) throw new Error('Server error: ' + response.status);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let lastEvent = 'message';

    function readChunk() {
      reader.read().then(({ done, value }) => {
        if (done) return;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            lastEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              handleEvent(lastEvent, data);
            } catch { /* skip malformed JSON */ }
          }
        }

        readChunk();
      }).catch(err => showError(err.message));
    }

    readChunk();
  }).catch(err => showError(err.message));
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
      <div class="value">${data.score || '-'}/10</div>
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

// Allow Enter key to submit
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('topic').addEventListener('keydown', e => {
    if (e.key === 'Enter') startGeneration();
  });
});
