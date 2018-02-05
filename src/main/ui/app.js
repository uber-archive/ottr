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
