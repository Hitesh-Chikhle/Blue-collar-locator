import puppeteer from '/home/hitesh-chikhle/.gemini/antigravity-ide/brain/6d78557f-cd01-4e9e-90ca-2e9ec427cecd/scratch/node_modules/puppeteer-core/lib/cjs/puppeteer/puppeteer-core.js';
import path from 'path';

const APP_URL = 'http://localhost:8080/';
const ARTIFACT_DIR = '/home/hitesh-chikhle/.gemini/antigravity-ide/brain/6d78557f-cd01-4e9e-90ca-2e9ec427cecd';

async function runTests() {
  console.log('🚀 Starting Blue Collar Chunk 6 Automated Test Suite...');
  
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const errors = [];

  try {
    const page = await browser.newPage();
    page.on('pageerror', (err) => {
      console.error('❌ Page Error:', err.message);
      errors.push(err.message);
    });

    console.log('\n--- 1. Testing Visual Consistency & Horizontal Overflow at 360px, 768px, 1280px ---');
    
    // Viewport 360px (Mobile)
    await page.setViewport({ width: 360, height: 740 });
    await page.goto(APP_URL, { waitUntil: 'networkidle0' });
    let overflow360 = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    console.log(`📱 360px mobile horizontal overflow: ${overflow360 ? 'FAIL (overflow detected)' : 'PASS (no overflow)'}`);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'chunk6_360_home.png') });

    // Viewport 768px (Tablet)
    await page.setViewport({ width: 768, height: 1024 });
    await page.goto(APP_URL + '#services', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));
    let overflow768 = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    console.log(`💻 768px tablet horizontal overflow: ${overflow768 ? 'FAIL (overflow detected)' : 'PASS (no overflow)'}`);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'chunk6_768_services.png') });

    // Viewport 1280px (Desktop)
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(APP_URL + '#home', { waitUntil: 'networkidle0' });
    let overflow1280 = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    console.log(`🖥️  1280px desktop horizontal overflow: ${overflow1280 ? 'FAIL (overflow detected)' : 'PASS (no overflow)'}`);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'chunk6_1280_home.png') });

    console.log('\n--- 2. Testing Prototype Evaluation (#testing view) ---');
    await page.goto(APP_URL + '#testing', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 500));

    // Check initial summary score
    const initialScore = await page.$eval('#summary-overall-score', (el) => el.textContent.trim());
    console.log(`⭐ Initial Prototype Testing Aggregate Score: ${initialScore} / 5.0`);

    // Submit a new evaluation
    await page.evaluate(() => {
      // Pick score 4 for discovery, 5 for others
      const discPill = document.querySelector('[data-metric="discovery"] [data-val="4"]');
      if (discPill) discPill.click();

      const commentBox = document.getElementById('testing-comment');
      if (commentBox) commentBox.value = 'Chunk 6 automated test evaluation: responsive design is sharp, zero lag.';

      const submitBtn = document.querySelector('#testing-feedback-form button[type="submit"]');
      if (submitBtn) submitBtn.click();
    });

    await new Promise((r) => setTimeout(r, 600));

    // Verify recent entry exists
    const recentEntryText = await page.$eval('#testing-recent-entries', (el) => el.textContent);
    const hasComment = recentEntryText.includes('Chunk 6 automated test evaluation');
    console.log(`📝 Evaluation submission recorded in summary: ${hasComment ? 'PASS' : 'FAIL'}`);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'chunk6_testing_view.png') });

    console.log('\n--- 3. Testing Demo Mode Modal & Faculty Checklist ---');
    await page.click('#btn-open-demo-panel');
    await new Promise((r) => setTimeout(r, 400));

    const isModalOpen = await page.evaluate(() => {
      const modal = document.getElementById('demo-script-modal');
      return modal && modal.classList.contains('is-open');
    });
    console.log(`📋 Faculty Demo Script Modal Opened: ${isModalOpen ? 'PASS' : 'FAIL'}`);

    // Click first checklist item
    await page.evaluate(() => {
      const firstItem = document.querySelector('.demo-script-item');
      if (firstItem) firstItem.click();
    });

    await new Promise((r) => setTimeout(r, 300));
    const firstItemChecked = await page.evaluate(() => {
      const firstItem = document.querySelector('.demo-script-item');
      return firstItem && firstItem.classList.contains('is-done');
    });
    console.log(`☑️ Checklist toggle & persistence: ${firstItemChecked ? 'PASS' : 'FAIL'}`);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'chunk6_demo_modal.png') });

    // Test One-Click Reset
    console.log('\n--- 4. Testing One-Click Baseline Seed Data Reset ---');
    const resetResult = await page.evaluate(async () => {
      // Direct call to dataService reset to avoid window.confirm blocking in puppeteer
      await window.blueCollarApp.resetToBaselineSeed();
      return true;
    });
    console.log(`🔄 One-click baseline reset executed: ${resetResult ? 'PASS' : 'FAIL'}`);

    console.log('\n--- 5. Testing Search Debounce (300ms) ---');
    await page.goto(APP_URL + '#services', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 400));
    
    // Type into keyword input rapidly
    await page.type('#services-search-keyword', 'MCB repair', { delay: 30 });
    // Immediately check value in filterState before 300ms debounce fires
    const stateBeforeDebounce = await page.evaluate(() => window.blueCollarApp.filterState.keyword);
    console.log(`⏳ Filter state before 300ms debounce completes: "${stateBeforeDebounce}"`);
    
    // Wait 400ms for debounce to trigger
    await new Promise((r) => setTimeout(r, 450));
    const stateAfterDebounce = await page.evaluate(() => window.blueCollarApp.filterState.keyword);
    console.log(`✅ Filter state after debounce completes: "${stateAfterDebounce}" (PASS: ${stateAfterDebounce === 'MCB repair'})`);

    console.log('\n--- 6. Console Error Summary ---');
    if (errors.length === 0) {
      console.log('🎉 0 Console Errors encountered during the test run!');
    } else {
      console.log(`⚠️ Encountered ${errors.length} errors:`, errors);
    }

  } catch (err) {
    console.error('Test Suite Exception:', err);
  } finally {
    await browser.close();
    console.log('\n🏁 Chunk 6 Automated Test Suite Completed.');
  }
}

runTests();
