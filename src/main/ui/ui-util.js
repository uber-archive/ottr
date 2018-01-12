// @flow

import type {Session, Test} from '../types';


export const red = 'red';
export const green = 'lightgreen';
export const blue = 'lightblue';
export const gray = 'lightgray';

export const getTestsInSession = ({names, tests}: Session): Test[] =>
  names.map(name => tests[name]);
