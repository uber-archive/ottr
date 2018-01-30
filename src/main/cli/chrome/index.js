/*
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

// @flow

import puppeteer from 'puppeteer';
import {logEachLine} from '../../util';
import libCoverage from 'istanbul-lib-coverage';
import {chromeCoverageToIstanbulJson} from "./coverage";

export class ChromeRunner {
  startupCompletePromise: Promise<*>;
  captureCoverage: boolean;
  browser: puppeteer.Browser;

  constructor(url: string, headless: boolean, coverage: boolean, chromeBinary?: string) {
    this.captureCoverage = coverage;
    this.startupCompletePromise = (async () => {
      this.browser = await puppeteer.launch({
        devtools: !headless,
        executablePath: chromeBinary || undefined
      });
      const page = await this.browser.newPage();
      if (coverage) {
        await page.coverage.startJSCoverage({resetOnNavigation: false});
      }
      page.on('console', msg => logEachLine(`[ottr:chrome]`, msg.text()));
      page.goto(url, {timeout: 0}).catch(e => console.error(e));
      return page;
    })();
  }

  async finish() {
    if (this.captureCoverage) {
      console.log('capturing coverage from Chrome');
      const page = await this.startupCompletePromise;
      const chromeCoverage = await page.coverage.stopJSCoverage();
      const istanbulCoverage = chromeCoverageToIstanbulJson(chromeCoverage);
      const map = libCoverage.createCoverageMap(global.__coverage__);
      map.merge(istanbulCoverage);
      global.__coverage__ = map.toJSON();
    }
    await this.browser.close();
  }
}

export async function runChrome() {}
