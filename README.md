[![Build Status](https://travis-ci.com/uber/ottr.svg?token=qo1PYvzxxbRdLH6pPH2T&branch=master)](https://travis-ci.com/uber/ottr)

# ottr

<img src="https://github.com/uber/ottr/blob/master/src/main/ui/static/images/ottr.png" width=200>

Easy, robust end-to-end UI tests for web apps.

Features:

* Write once, run in every web browser (Chrome, Firefox, IE, Edge, Safari, iOS, Android)
* Super robust. Does not use Selenium or Chrome DevTools or Electron or anything special
* Can run tests against your local development server or production server
* Can be used as a command-line test runner (requires headless browser)
* Web-based UI for:
  * Interactively debugging tests in your browser of choice
  * Built-in test authoring REPL for rapid development of new test cases
* Automatically takes screenshots and records all network requests

## Installation and Usage

Assuming you have a `npm run watch` script in your project, which starts your web server 
on port 3000:

```
npm install --save-dev ottr
node_modules/.bin/ottr --server 'npm run watch' localhost:3000 src/test/e2e/index.js
```

Then just visit the URL printed to the console (defaults to http://localhost:50505/ottr/ui)

## Command Line Reference

```
Usage: ottr [options] <url> <file>

  url:  the website to run your tests against
  file: root end-to-end test file that runs all your tests


Options:

  -s, --server <cmd>     command ottr uses to launch your server, e.g. 'npm run watch'
  -c, --chrome           opens headless Chrome/Chromium to the ottr UI to run your tests
  --chromium <path>      uses the specified Chrome/Chromium binary to run your tests
  --host <ip>            Chrome will use this hostname or IP address instead of localhost
  --coverage <type>      use 'chrome' for code coverage from Chrome DevTools (see below)
  --screenshots          take screenshots every 100ms
  --concurrency <n>      number of tests ottr should run in simultaneous iframes
  --wait-timeout <secs>  max server startup wait time (see --wait-path)
  --wait-path <path>     wait for your server to return 200 for this path (e.g., /health)
  -d, --debug            keep ottr running indefinitely after tests finish
  -i, --inspect          runs Chrome in GUI mode so you can watch tests run interactively
  -h, --help             output usage information
```

## Examples

ottr tests are written using a wrapper around [tape](https://github.com/substack/tape), a simple 
yet powerful testing and assertion library.

```js
import {setValue, sleep, test} from 'ottr';
import $ from 'jquery';

test('searching for uuid works', '/', async t => {
  $('.search-icon').click();
  setValue($('.searchBox input')[0], 'doctor');
  await sleep(500);
  t.equal($('.result').text(), 'Doctor Seuss');
  t.end();
});
```

### Command-Line Examples

```
  $ ottr --chrome --debug localhost:9999 src/test/e2e.js
```

Runs your tests in e2e.js against your local development server using
a headless Chrome browser. The --debug option leaves ottr running so
you can debug interactively using the browser of your choice. (Your
server must already be running on port 9999.)

```
  $ nyc --reporter=html ottr --coverage=chrome https://google.com dist-test/e2e.js
```

Runs your tests against Google's home page, in a Chrome headless
browser, with Chrome's built-in code coverage recording. nyc (the
istanbul command-line tool) generates an HTML coverage report.

## Under the Hood

How does ottr work?

ottr's main benefit is that it runs your test code *inside your web app itself*, rather than in a 
separate browser window or Node process.

However, this gets a little tricky because of web standards, particularly cross-origin protections.
To bypass browser security, ottr:

* Sets up a full HTTP proxy to the website you're testing (via [`http-proxy-middleware`](https://github.com/chimurai/http-proxy-middleware))
* Injects your test code into the page *at the network level* (via [`webpack`](https://github.com/webpack/webpack))

## Contributing

We'd love for you to contribute to this project. Before we can accept your contributions, we kindly 
ask you to sign our [Uber Contributor License Agreement](https://docs.google.com/a/uber.com/forms/d/1pAwS_-dA1KhPlfxzYLBqK6rsSWwRwH95OCCZrcsY5rk/viewform).

- If you **find a bug**, please open an issue, or submit a fix via a pull request
- If you **have a feature request**, open an issue, or submit an implementation via a pull request
- If you **want to contribute**, submit a pull request

Thanks!
