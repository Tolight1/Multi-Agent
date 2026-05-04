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
