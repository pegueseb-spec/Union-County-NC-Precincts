const path = require('node:path');
const { chromium, devices } = require('playwright');

const appUrl = 'https://pegueseb-spec.github.io/Union-County-NC-Precincts/';
const cwd = process.cwd();
const files = [
  path.join(cwd, 'public', 'data', 'demo-voter.csv'),
  path.join(cwd, 'public', 'data', 'demo-history.csv'),
  path.join(cwd, 'public', 'data', 'demo-cvap.csv'),
];

const scenarios = [
  {
    name: 'desktop',
    contextOptions: { viewport: { width: 1440, height: 960 } },
  },
  {
    name: 'mobile',
    contextOptions: devices['iPhone 13'],
  },
];

(async () => {
  for (const scenario of scenarios) {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext(scenario.contextOptions);
    const page = await context.newPage();
    const result = {
      device: scenario.name,
      passed: false,
      uploadSummarySeen: false,
      mapVisible: false,
      insightsVisible: false,
    };

    try {
      await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.getByRole('button', { name: /data upload/i }).click();

      const inputs = page.locator('input[type="file"]');
      await inputs.nth(0).setInputFiles(files[0]);
      await inputs.nth(1).setInputFiles(files[1]);
      await inputs.nth(2).setInputFiles(files[2]);

      await page.getByText('CVAP Upload Summary').waitFor({ timeout: 60000 });
      result.uploadSummarySeen = true;

      await page.getByRole('button', { name: /dashboard/i }).click();
      await page.getByText('Turnout Choropleth Map').waitFor({ timeout: 60000 });
      await page.getByText('Precinct Insights').waitFor({ timeout: 60000 });

      result.mapVisible = await page.locator('svg').first().isVisible();
      result.insightsVisible = true;

      const pageText = await page.locator('body').textContent();
      if ((pageText || '').includes('Map Error')) {
        throw new Error('Map error was rendered during live smoke test.');
      }

      result.passed = result.uploadSummarySeen && result.mapVisible && result.insightsVisible;
    } catch (error) {
      result.error = String(error);
    } finally {
      console.log(JSON.stringify(result));
      await browser.close();
    }
  }
})();
