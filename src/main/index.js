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

import 'whatwg-fetch';

window.console = new Proxy(console, {
  methods: {},
  get(target, property) {
    if (typeof property === 'string' && typeof target[property] === 'function') {
      if (!this.methods[property])
        this.methods[property] = (...args) => {
          fetch(`/_ottr/console/${property}`, {
            method: 'POST',
            body: JSON.stringify(args),
            headers: {
              'Content-Type': 'application/json'
            }
          });
          target[property](...args);
        };
      return this.methods[property];
    }

    return target[property];
  }
});

window.addEventListener('error', e => {
  console.error(e);
  ottr.fail();
});

const trimLeadingSlash = str => (str[0] === '/' ? str.substring(1) : str);

async function ottr(path: string) {
  return new Promise(resolve => {
    //TODO: delete old iframe?
    const iframe = document.createElement('iframe');
    iframe.onload = () => resolve(iframe.contentWindow);
    // $FlowFixMe
    iframe.src = `http://localhost:${process.env.OTTR_PORT}/${trimLeadingSlash(path)}`;
    // $FlowFixMe
    document.body.appendChild(iframe);
  });
}

Object.assign(ottr, {
  async done() {
    await fetch('/_ottr/done', {method: 'POST'});
  },

  async fail() {
    await fetch('/_ottr/fail', {method: 'POST'});
  }
});

export default ottr;
