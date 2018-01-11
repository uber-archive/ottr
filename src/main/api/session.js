// @flow

/* eslint-env browser */

function getQueryVariable(name) {
  const query = window.location.search.substring(1);
  const vars = query.split('&');
  for (const part of vars) {
    const [key, value] = part.split('=');
    if (decodeURIComponent(key) === name) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

export const currentTestSession = getQueryVariable('ottr-session');
export const currentTestName = getQueryVariable('ottr-test');
export const isMainTestRunner = currentTestSession && !currentTestName;
