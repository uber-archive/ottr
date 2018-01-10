// @flow

export type Test = {
  name: string,
  path: string,
  running?: boolean,
  done?: boolean,
  skipped?: boolean,
  error?: boolean,
  output?: string
};
