// @flow

import type {Session} from '../types';

export type ReduxStateType = {
  +runner: {
    +concurrency: number,
    +sessions: {
      [id: string]: Session
    }
  }
};
