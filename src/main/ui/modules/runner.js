/*
 * @flow
 *
 * MIT License
 *
 * Copyright (c) 2017 Uber Node.js
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/* eslint-env browser */

import type {ActionsObservable} from 'redux-observable';
import type {ReduxStateType} from '../types';
import type {Action} from '.';
import {Observable} from 'rxjs/Observable';
import {combineEpics} from 'redux-observable';
import type {Test} from '../../types';
import type {MiddlewareAPI} from 'redux';
import produce from 'immer';
import {getTestsInSession} from '../ui-util';

type RunnerState = $PropertyType<ReduxStateType, 'runner'>;

type UpdateSessionAction = {
  type: 'UPDATE_SESSION',
  payload: {id: string, concurrency: number, tests: {[string]: Test}}
};
export type RunnerAction =
  | {type: 'START_TEST', session: string, name: string}
  | {type: 'STOP_TEST', session: string, name: string}
  | {type: 'START_SOME_TESTS', session: string}
  | UpdateSessionAction;

const normalizeTestObject = test => {
  test.iteration = test.iteration || 0;
  test.running = test.running && !test.done;
};

const initialState: RunnerState = {
  sessions: {}
};

export const restart = (session: string, name: string): RunnerAction => ({
  type: 'START_TEST',
  session,
  name
});

export const stop = (session: string, name: string): RunnerAction => ({
  type: 'STOP_TEST',
  session,
  name
});

export const reducer = (state: RunnerState = initialState, action: RunnerAction): RunnerState => {
  switch (action.type) {
    case 'START_SOME_TESTS': {
      const {session} = action;
      return produce(state, (s: RunnerState) => {
        const sess = s.sessions[session];
        const tests = getTestsInSession(sess);
        let numberOfTestsToStart = sess.concurrency - tests.filter(test => test.running).length;
        for (const test of tests) {
          if (!test.running && !test.done && numberOfTestsToStart > 0) {
            numberOfTestsToStart--;
            test.running = true;
          }
        }
      });
    }
    case 'START_TEST': {
      const {session, name} = action;
      return produce(state, (s: RunnerState) => {
        const t = s.sessions[session].tests[name];
        t.iteration++;
        t.running = true;
      });
    }
    case 'STOP_TEST': {
      const {session, name} = action;
      return produce(state, (s: RunnerState) => {
        const test = s.sessions[session].tests[name];
        test.running = false;
        test.skipped = true;
      });
    }
    case 'UPDATE_SESSION': {
      const {payload: {id, concurrency, tests}} = action;
      return produce(state, (s: RunnerState) => {
        let localSession = s.sessions[id];
        if (!localSession) {
          localSession = s.sessions[id] = {id, concurrency, names: [], tests: {}};
        }
        for (const name in tests) {
          const testFromServer = tests[name];
          localSession.tests[name] = {...(localSession.tests[name] || {}), ...testFromServer};
          normalizeTestObject(localSession.tests[name]);
          if (!localSession.names.includes(name)) {
            localSession.names.push(name);
          }
        }
      });
    }
    default:
      return state;
  }
};

const startTestsEpic = (
  action$: ActionsObservable<Action>,
  store: MiddlewareAPI<ReduxStateType, Action>
) =>
  action$
    .ofType('UPDATE_SESSION')
    .filter((action: UpdateSessionAction) => {
      const state = store.getState().runner;
      const session = state.sessions[action.payload.id];
      if (!session) {
        return false;
      }
      const tests = getTestsInSession(session);
      const running = tests.filter(t => t.running);
      const queued = tests.filter(t => !t.running && !t.done && !t.skipped);
      const shouldBeRunning = Math.min(queued.length, session.concurrency);
      return running.length < shouldBeRunning;
    })
    .switchMap((action: UpdateSessionAction) =>
      Observable.of({
        type: 'START_SOME_TESTS',
        session: action.payload.id
      })
    );

export const pollSession = async (sessionId: string) => ({
  type: 'UPDATE_SESSION',
  payload: (await fetch(`/_ottr/api/session/${sessionId}`)).json()
});

export const epic = combineEpics(startTestsEpic);
