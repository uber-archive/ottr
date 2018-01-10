// @flow

/* eslint-env browser */

import type {ActionsObservable} from 'redux-observable';
import type {ReduxStateType} from '../types';
import type {Action} from '.';
import {Observable} from 'rxjs/Observable';
import {combineEpics} from 'redux-observable';
import type {Test} from '../../types';
import type {MiddlewareAPI} from 'redux';

type RunnerState = $PropertyType<ReduxStateType, 'runner'>;

export type RunnerAction =
  | {type: 'START_TEST', name: string}
  | {type: 'START_SOME_TESTS'}
  | {type: 'UPDATE_SESSION', payload: {tests: {[string]: Test}}};

const initialState: RunnerState = {
  sessionId: window.ottrSessionId,
  concurrency: 4,
  tests: Object.keys(window.ottrTests).map(name => window.ottrTests[name])
};

const fixRunningStatus = test => ({...test, running: test.running && !test.done});

export const restart = (testName: string) => ({type: 'RESTART_TEST', testName});

export const stop = (testName: string) => ({type: 'STOP_TEST', testName});

export const reducer = (state: RunnerState = initialState, action: RunnerAction): RunnerState => {
  switch (action.type) {
    case 'START_SOME_TESTS':
      const running = state.tests.filter(test => test.running);
      let numberOfTestsToStart = state.concurrency - running.length;
      const tests = state.tests.map(test => {
        if (!test.running && !test.done && numberOfTestsToStart > 0) {
          numberOfTestsToStart--;
          return {...test, running: true};
        }
        return test;
      });
      return {...state, tests};
    case 'UPDATE_SESSION':
      const newTests = action.payload.tests;
      return {
        ...state,
        tests: state.tests.map(test => fixRunningStatus({...test, ...newTests[test.name]}))
      };
    default:
      return state;
  }
};

const startTestsEpic = (action$: ActionsObservable<Action>) =>
  action$.ofType('STARTUP', 'UPDATE_SESSION').mapTo({type: 'START_SOME_TESTS'});

const pollSessionEpic = (
  action$: ActionsObservable<Action>,
  store: MiddlewareAPI<ReduxStateType, Action>
) =>
  action$.ofType('STARTUP').switchMap(() =>
    Observable.timer(0, 1000)
      .takeUntil(action$.ofType('SHUTDOWN'))
      .exhaustMap(() =>
        // $FlowFixMe
        Observable.ajax({url: `/_ottr/api/session/${store.getState().runner.sessionId}`})
          .map(res => ({type: 'UPDATE_SESSION', payload: res.response}))
          .catch(error => Observable.of({type: 'SESSION_ERROR', error}))
      )
  );

export const epic = combineEpics(startTestsEpic, pollSessionEpic);
