// @flow

export type Test = {
  name: string,
  path: string,
  running: boolean,
  done: boolean,
  error: boolean
};

export type ReduxStateType = {
  +runner: {|
    +concurrency: number,
    +tests: Test[]
  |}
};
