// @flow

/* eslint-env browser */

import React from 'react';
import {Provider} from 'react-redux';
import {createStore} from 'redux';
import reducer from '../modules';
import Home from './home';

const store = createStore(
  reducer,
  window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__()
);

export default function App() {
  return (
    <Provider store={store}>
      <Home />
    </Provider>
  );
}
