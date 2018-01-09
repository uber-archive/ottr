// @flow

/* eslint-env browser */

import React from 'react';
import {Provider} from 'react-redux';
import {applyMiddleware, compose, createStore} from 'redux';
import {createEpicMiddleware} from 'redux-observable';
import {reducer, epic} from './modules';
import Home from './components/home';
import 'rxjs';

const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
const store = createStore(reducer, composeEnhancers(applyMiddleware(createEpicMiddleware(epic))));
store.dispatch({type: 'STARTUP'});

export default function App() {
  return (
    <Provider store={store}>
      <Home />
    </Provider>
  );
}
