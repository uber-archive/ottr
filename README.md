# ottr

Easy, robust end-to-end UI tests for web apps.

Features:

* Write once, run in every web browser (Chrome, Firefox, IE, Edge, Safari, iOS, Android)
* Can use any test framework (Jest, Ava, Tape, Mocha, ...)
* Super robust. Does not use Selenium or Chrome DevTools or Electron or anything special.

## Installation and Usage

Assuming you have a `npm run watch` script in your project, which starts your server on port 9999:

```
npm install --save-dev ottr
npm run watch
ottr localhost:9999 src/test/e2e/index.js
```

## Contributing

We'd love for you to contribute to this project. Before we can accept your contributions, we kindly 
ask you to sign our [Uber Contributor License Agreement](https://docs.google.com/a/uber.com/forms/d/1pAwS_-dA1KhPlfxzYLBqK6rsSWwRwH95OCCZrcsY5rk/viewform).

- If you **find a bug**, please open an issue, or submit a fix via a pull request
- If you **have a feature request**, open an issue, or submit an implementation via a pull request
- If you **want to contribute**, submit a pull request

Thanks!
