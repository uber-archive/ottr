// @flow

export type Test = {name: string, path: string};

export type ReduxStateType = {
  +runner: {|
    +concurrency: number,
    +tests: Test[]
  |}
}