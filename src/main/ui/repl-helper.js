/* eslint-env browser */

import test from 'tape';
import $ from 'jquery';
import {setValue, sleep} from '../api';
window.$ = $;
window.jQuery = $;
window.setValue = setValue;
window.test = test;
window.sleep = sleep;
