/*
 * @flow
 *
 * MIT License
 *
 * Copyright (c) 2017 Uber Node.js
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import puppeteer from 'puppeteer';
import {logEachLine} from '../../util';
import libCoverage from 'istanbul-lib-coverage';
import {chromeCoverageToIstanbulJson} from './coverage';
import {ScreenshotSequenceCapturer} from './screenshots';

export class ChromeRunner {
  startupCompletePromise: Promise<*>;
  captureCoverage: boolean;
  browser: puppeteer.Browser;
  page: puppeteer.Page;
  screenshots: ?ScreenshotSequenceCapturer;

  // eslint-disable-next-line max-params
  constructor(
    exit: number => any,
    url: string,
    sessionId: string,
    headless: boolean,
    coverage: boolean,
    chromeBinary: ?string,
    screenshotIntervalMs: ?number
  ) {
    this.startupCompletePromise = (async () => {
      this.captureCoverage = coverage;
      if (chromeBinary) {
        console.log(`[ottr] using Chrome binary at ${chromeBinary}`);
      }
      this.browser = await puppeteer.launch({
        devtools: !headless,
        executablePath: chromeBinary || undefined
      });
      this.page = await this.browser.newPage();
      if (coverage) {
        await this.page.coverage.startJSCoverage({resetOnNavigation: false});
      }
      this.page.on('console', msg => logEachLine(`[ottr:chrome]`, msg.text()));
      this.page.goto(url, {timeout: 0}).catch(e => console.error(e));
      if (screenshotIntervalMs) {
        this.screenshots = new ScreenshotSequenceCapturer(
          this.page,
          sessionId,
          screenshotIntervalMs
        );
      }
      return this.page;
    })();
    this.startupCompletePromise.catch(exit);
  }

  async finish() {
    if (this.screenshots) {
      await this.screenshots.finish();
    }
    if (this.captureCoverage) {
      console.log('[ottr] downloading and converting coverage data from Chrome...');
      const page = await this.startupCompletePromise;
      console.log('[ottr] - downloading');
      const chromeCoverage = await page.coverage.stopJSCoverage();
      console.log(chromeCoverage.map(x => x.url));
      const istanbulCoverage = await chromeCoverageToIstanbulJson(chromeCoverage);
      const map = libCoverage.createCoverageMap(global.__coverage__);
      map.merge(istanbulCoverage);
      // There's probably a faster way to do this, but we need to convert it back to JSON to prevent
      // instanceof checks from failing deep within istanbul. Long story short, if you have multiple
      // copies of 'istanbul-lib-coverage' in node_modules (which for some reason we do), you need
      // to convert to JSON here.
      global.__coverage__ = JSON.parse(JSON.stringify(map));
      Object.keys(global.__coverage__).forEach(x => console.log(x));
    }
    if (this.browser) {
      await this.browser.close();
    }
  }
}
