// @flow

/* eslint-env browser */

import React from 'react';
import {Provider} from 'react-redux';
import {applyMiddleware, compose, createStore} from 'redux';
import {createEpicMiddleware} from 'redux-observable';
import {BrowserRouter, Redirect, Route} from 'react-router-dom';
import {reducer, epic} from './modules';
import Tests from './components/tests';
import Repl from './components/repl';
import {UI_BASE_URI} from '../util';
import promiseMiddleware from 'redux-promise';

const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
const middleware = composeEnhancers(applyMiddleware(createEpicMiddleware(epic), promiseMiddleware));
const store = createStore(reducer, middleware);

const randomSessionId = () => Math.round(Math.random() * 10000);

const CreateSession = () => <Redirect push to={`/session/${randomSessionId()}`} />;

const Routes = () => [
  <Route key="/repl" path="/repl" component={Repl} />,
  <Route exact key="/session" path="/session/:id" component={Tests} />,
  <Route exact key="/" path="/" component={CreateSession} />
];

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter basename={UI_BASE_URI}>
        <Routes />
      </BrowserRouter>
    </Provider>
  );
}
