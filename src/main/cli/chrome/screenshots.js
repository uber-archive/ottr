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

import path from 'path';
import mkdirp from 'mkdirp';
import puppeteer from 'puppeteer';
import {sleep} from '../../util';

function pad(num, chars) {
  let val = `${num}`;
  while (val.length < chars) {
    val = `0${val}`;
  }
  return val;
}

const asyncMkdirp = (p, opts?) =>
  new Promise((resolve, reject) =>
    mkdirp(p, opts, (err, val) => (err ? reject(err) : resolve(val)))
  );

export class ScreenshotSequenceCapturer {
  screenshotTimeout: ?TimeoutID;
  screenshotIntervalMs: number;
  screenshotNumber: number = 0;
  screenshotFolder: string;
  mkdirPromise: Promise<*>;
  screenshotPromise: Promise<*>;
  page: puppeteer.Page;

  constructor(page: puppeteer.Page, sessionId: string, screenshotIntervalMs: number) {
    this.page = page;
    this.screenshotIntervalMs = screenshotIntervalMs;
    this.screenshotFolder = path.resolve('ottr/sessions', sessionId, 'screenshots');

    this.mkdirPromise = asyncMkdirp(this.screenshotFolder);
    this.takeScreenshot();
  }

  takeScreenshot = () =>
    // $FlowFixMe - no idea why Flow doesn't understand Promise.finally
    this.takeScreenshotAsync()
      .catch(this.logError)
      .finally(
        () => (this.screenshotTimeout = setTimeout(this.takeScreenshot, this.screenshotIntervalMs))
      );

  logError = (e: Error) => {
    if (!(e && e.message && e.message.match(/target closed/i))) {
      console.error('[ottr] could not capture screenshot from Chrome', e);
    }
  };

  async takeScreenshotAsync() {
    await this.mkdirPromise;
    this.screenshotPromise = this.page.screenshot({
      fullPage: true,
      path: path.resolve(this.screenshotFolder, `ottr-${pad(this.screenshotNumber++, 4)}.png`)
    });
    await this.screenshotPromise;
  }

  async finish() {
    if (this.screenshotTimeout) {
      clearTimeout(this.screenshotTimeout);
      this.screenshotTimeout = null;
    }
    await this.completeMostRecentScreenshot();
    await this.takeFinalScreenshot();
    if (this.screenshotNumber > 0) {
      console.log(`[ottr] saved ${this.screenshotNumber} screenshots to ${this.screenshotFolder}`);
    } else {
      console.error('[ottr] screenshot capture failed mysteriously');
    }
  }

  async takeFinalScreenshot() {
    try {
      // Take a final screenshot
      await Promise.race([this.takeScreenshotAsync(), sleep(1000)]);
    } catch (e) {
      this.logError(e);
    }
  }

  async completeMostRecentScreenshot() {
    try {
      // Wait for most recent screenshot to finish
      if (this.screenshotPromise) {
        await Promise.race([this.screenshotPromise, sleep(1000)]);
      }
    } catch (e) {
      this.logError(e);
    }
  }
}
