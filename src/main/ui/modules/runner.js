// @flow

/* eslint-env browser */

import {compose} from 'redux';
import type {ActionsObservable} from 'redux-observable';
import type {ReduxStateType} from '../types';
import type {Action} from '.';

type RunnerState = $PropertyType<ReduxStateType, 'runner'>;

export type RunnerAction = {type: 'START_TEST', name: string} | {type: 'START_SOME_TESTS'};

const initialState: RunnerState = {
  concurrency: 4,
  tests: Object.keys(window.ottrTests).map(name => window.ottrTests[name])
};

export const reducer = (state: RunnerState = initialState, action: RunnerAction): RunnerState => {
  switch (action.type) {
    case 'START_SOME_TESTS':
      const queued = state.tests.filter(test => !test.running && !test.done);
      const running = state.tests.filter(test => test.running);
      let numberOfTestsToStart = Math.max(state.concurrency - running.length, queued.length);
      const tests = state.tests.map(test => {
        if (numberOfTestsToStart > 0) {
          numberOfTestsToStart--;
          return {...test, running: true};
        } else {
          return test;
        }
      });
      return {...state, tests};
    default:
      return state;
  }
};

export const epic = (action$: ActionsObservable<Action>) =>
  action$
    .ofType('STARTUP')
    .delay(1000) // Asynchronously wait 1000ms then continue
    .mapTo({type: 'START_SOME_TESTS'});
