/* eslint-env browser */

import test from 'tape';
import $ from 'jQuery';
import {setValue, sleep} from '../api';
window.$ = $;
window.jQuery = $;
window.setValue = setValue;
window.test = test;
window.sleep = sleep;
