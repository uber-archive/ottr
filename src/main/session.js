// @flow

/* eslint-env browser */

console.log('loading session');
function getQueryVariable(name) {
  const query = window.location.search.substring(1);
  const vars = query.split('&');
  for (const part of vars) {
    const [key, value] = part.split('=');
    console.log(key, value)
    if (decodeURIComponent(key) === name) {
      return decodeURIComponent(value);
    }
  }
  return null;
}
const getCurrentTestSessionFromUri = () => getQueryVariable('ottr-session');
const getCurrentTestNameFromUri = () => getQueryVariable('ottr-test');

export const isMainTestRunner = window.location.pathname === '/_ottr/';
export const currentTestName = getCurrentTestNameFromUri();

const getCurrentTestSession = () => {
  if (isMainTestRunner) {
    const id = window.ottrSessionId;
    if (!id) {
      throw new Error(`we're in the main test runner, but id is ${id}`);
    }
    return id;
  }
  if (currentTestName) {
    return getCurrentTestSessionFromUri();
  }
  return null;
};

export const currentTestSession = getCurrentTestSession();

console.log(window.location, isMainTestRunner, currentTestSession, currentTestName)
