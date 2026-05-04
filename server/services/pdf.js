const { marked } = require('marked');
const puppeteer = require('puppeteer');

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
