// @flow

export type Test = {name: string, path: string};

export type ReduxStateType = {
  +tests: {|
    +tests: Test[]
  |}
}