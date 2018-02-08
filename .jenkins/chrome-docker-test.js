const path = require('path');

const puppeteer = require('puppeteer');

(async () => {
  // const browser = await puppeteer.launch({});
  const browser = await puppeteer.launch({executablePath: path.resolve('.jenkins/chrome-docker.sh')});
  const page = await browser.newPage();
  await page.goto('https://google.com');
  await page.screenshot({path: 'example.png'});
  console.log(await page.content());

  await browser.close();
})().catch(e => console.error(e));