// @flow

import type {Test} from '../types';

export type ReduxStateType = {
  +runner: {|
    +sessionId: string,
    +concurrency: number,
    +tests: Test[]
  |}
};
