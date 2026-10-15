const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (error) {
  console.error('Playwright is not installed. Run `npm install` in social/carousel first.');
  process.exitCode = 1;
  return;
}

const root = __dirname;
const slidesPath = path.join(root, 'slides', 'semana3.json');
const templatePath = path.join(root, 'template.html');
const outputDir = path.join(root, 'out');

function validateSlides(slides) {
  if (!Array.isArray(slides)) {
    throw new Error('slides/semana3.json must contain an array.');
  }

  slides.forEach((slide, index) => {
    if (!slide || typeof slide !== 'object') {
      throw new Error(`Slide ${index + 1} must be an object.`);
    }

    for (const field of ['title', 'body', 'footer']) {
      if (typeof slide[field] !== 'string') {
        throw new Error(`Slide ${index + 1} field "${field}" must be a string.`);
      }
    }
  });
}

async function render() {
  const slides = JSON.parse(await fs.readFile(slidesPath, 'utf8'));
  validateSlides(slides);
  await fs.mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1080, height: 1350 },
      deviceScaleFactor: 1,
    });

    await page.goto(pathToFileURL(templatePath).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);

    for (const [index, slide] of slides.entries()) {
      await page.evaluate((data) => {
        for (const [field, value] of Object.entries(data)) {
          document.querySelector(`[data-field="${field}"]`).textContent = value;
        }
      }, slide);

      const filename = `semana3-${String(index + 1).padStart(2, '0')}.png`;
      await page.screenshot({
        path: path.join(outputDir, filename),
        type: 'png',
      });
      console.log(`Rendered ${filename}`);
    }
  } finally {
    await browser.close();
  }
}

render().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
