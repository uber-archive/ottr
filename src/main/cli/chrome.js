// @flow

import puppeteer from 'puppeteer';
import {logEachLine} from '../util';

export const runChrome = async (url: string, headless: boolean, chromeBinary?: string) => {
  const browser = await puppeteer.launch({
    devtools: !headless,
    executablePath: chromeBinary || undefined
  });
  const page = await browser.newPage();
  page.on('console', msg => logEachLine(`[ottr:chrome]`, msg.text()));
  await page.goto(url);
};
