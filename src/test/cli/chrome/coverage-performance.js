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

/* eslint-env node */
/* eslint-disable no-process-exit */

import 'source-map-support/register';

import fs from 'fs';

import {chromeCoverageToIstanbulJson} from '../../../main/cli/chrome/coverage';

async function go() {
  const cov = JSON.parse(fs.readFileSync('/Users/keithl/Downloads/chrome.json', 'utf8'));
  const start = Date.now();
  const result = await chromeCoverageToIstanbulJson(cov);
  console.log(`took ${Math.round((Date.now() - start) / 1000)} sec`);
  console.log(Object.keys(result));
}

go().catch(e => {
  console.log(e);
  process.exit(1);
});
