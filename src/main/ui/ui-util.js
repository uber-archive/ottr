// @flow

import type {Session, Test} from '../types';

export const getTestsInSession = ({names, tests}: Session): Test[] =>
  names.map(name => tests[name]);
