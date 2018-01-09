// @flow

/* eslint-env browser */

import {compose} from 'redux';
import type {ReduxStateType} from '../types';

const initialState: $PropertyType<ReduxStateType, 'tests'> = {
  tests: Object.keys(window.ottrTests).map(name => window.ottrTests[name])
};

export default compose(state => ({...initialState}));
