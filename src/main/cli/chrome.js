// @flow

import puppeteer from 'puppeteer';
import {logEachLine} from '../util';

export const runChrome = async (url: string) => {
  const browser = await puppeteer.launch({headless: false});
  const page = await browser.newPage();
  page.on('console', msg => logEachLine(`[ottr:chrome]`, msg.text()));
  await page.goto(url);
  // await browser.close();
};
