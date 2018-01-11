// @flow

export type Test = {
  session: string,
  name: string,
  /** Path part of URI - note that this is currently only present on the browser */
  path: string,
  /** This is incremented each time the user clicks "restart" on a test */
  iteration: number,
  running?: boolean,
  done?: boolean,
  skipped?: boolean,
  error?: boolean,
  output?: string
};

export type Session = {
  +id: string,
  +names: string[],
  +tests: {[name: string]: Test}
};
