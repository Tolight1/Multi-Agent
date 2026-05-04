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
