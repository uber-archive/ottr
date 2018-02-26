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
import puppeteer from 'puppeteer';
import {failAfter} from '../../util';
import {asyncMkdirp} from '../util';
import GIFEncoder from 'gifencoder';
import {PNG} from 'pngjs';
import fs from 'fs';

function pad(num, chars) {
  let val = `${num}`;
  while (val.length < chars) {
    val = `0${val}`;
  }
  return val;
}

export class ScreenshotSequenceCapturer {
  screenshotTimeout: ?TimeoutID;
  screenshotIntervalMs: number;
  screenshotNumber: number = 0;
  screenshotFolder: string;
  sessionId: string;
  mkdirPromise: Promise<*>;
  screenshotPromise: Promise<*>;
  page: puppeteer.Page;
  gif: typeof GIFEncoder;

  constructor(page: puppeteer.Page, sessionId: string, screenshotIntervalMs: number) {
    this.page = page;
    this.sessionId = sessionId;
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
    if (!(e && e.message && e.message.match(/(target|session) closed/i))) {
      console.error('[ottr] could not capture screenshot from Chrome', e);
    }
  };

  async takeScreenshotAsync() {
    await this.mkdirPromise;
    this.screenshotPromise = this.page.screenshot({
      // fullPage: true,
      path: path.resolve(this.screenshotFolder, `ottr-${pad(this.screenshotNumber++, 4)}.png`)
    });
    const buf = await this.screenshotPromise;
    await this.writeGifFrame(buf);
  }

  async writeGifFrame(buf: Buffer) {
    const png = new PNG();
    const metadataPromise = new Promise((resolve, reject) => {
      png.on('metadata', resolve);
      png.on('error', reject);
    });
    const imgPromise = new Promise(resolve => png.on('parsed', resolve));
    png.parse(buf);
    const {width, height} = await metadataPromise;
    // TODO: check that the width is the same, and rescale if necessary
    if (!this.gif) {
      this.gif = new GIFEncoder(width, height);
      this.gif.start();
      this.gif.setRepeat(0);
      this.gif.setDelay(100);
    }
    this.gif.addFrame(await imgPromise);
  }

  async finish() {
    if (this.screenshotTimeout) {
      clearTimeout(this.screenshotTimeout);
      this.screenshotTimeout = null;
    }
    await this.completeMostRecentScreenshot();
    await this.takeFinalScreenshot();

    if (this.screenshotNumber > 0) {
      if (this.gif) {
        this.gif.finish();
        fs.writeFileSync(
            path.resolve(this.screenshotFolder, `ottr-${this.sessionId}.gif`),
            this.gif.out.getData()
        );
      }
      console.log(`[ottr] saved ${this.screenshotNumber} screenshots to ${this.screenshotFolder}`);
    } else {
      console.error('[ottr] screenshot capture failed mysteriously');
    }
  }

  async completeMostRecentScreenshot() {
    if (this.screenshotPromise) {
      try {
        await Promise.race([this.screenshotPromise, failAfter(10000)]);
      } catch (e) {
        this.logError(e);
      }
    }
  }

  async takeFinalScreenshot() {
    try {
      await Promise.race([this.takeScreenshotAsync(), failAfter(10000)]);
    } catch (e) {
      this.logError(e);
    }
  }
}
