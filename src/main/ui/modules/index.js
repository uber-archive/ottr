// @flow

import {combineReducers} from 'redux';
import {combineEpics} from 'redux-observable';
import {reducer as runner, epic as runnerEpic} from './runner';
import type {RunnerAction} from './runner';

export const reducer = combineReducers({runner});
export const epic = combineEpics(runnerEpic);
export type Action = RunnerAction;