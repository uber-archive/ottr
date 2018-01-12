# ottr

Easy, robust end-to-end UI tests for web apps.

Features:

* Write once, run in every web browser (Chrome, Firefox, IE, Edge, Safari, iOS, Android)
* Can use any test framework (Jest, Ava, Tape, Mocha, ...)
* Super robust. Does not use Selenium or Chrome DevTools or Electron or anything special.
* Can run tests against your local development server or production server
* Can be used as a command-line test runner (requires headless browser)
* Web-based UI for:
  * Interactively debugging tests in your browser of choice
  * Built-in test authoring REPL for rapid development of new test cases

## Installation and Usage

Assuming you have a `npm run watch` script in your project, which starts your web server 
on port 3000:

```
npm install --save-dev ottr
npm run watch
node_modules/.bin/ottr localhost:3000 src/test/e2e/index.js
```

Then just visit the URL printed to the console (defaults to http://localhost:50505/ottr/ui)

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
