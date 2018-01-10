// @flow

export type Test = {
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
