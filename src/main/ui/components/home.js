// @flow

import React from 'react';
import {connect} from 'react-redux';
import type {ReduxStateType} from '../types';
import DocumentTitle from 'react-document-title';
import type {Test} from '../../types';
import TestDisplay from './test-display';

const EMOJI_CHECK = '\u2705';
const EMOJI_X = '\u274C';

function Home({tests}: {tests: Test[]}) {
  const running = tests.filter(t => t.running);
  const failed = tests.filter(t => t.error);
  const done = tests.filter(t => t.done);
  const emojis =
    failed.length > 0
      ? failed.map(() => EMOJI_X).join('')
      : done.length === tests.length ? EMOJI_CHECK : '';
  const progress =
    done.length !== tests.length ? ` ${Math.round(done.length / tests.length * 100)}%` : '';
  return (
    <div>
      <DocumentTitle title={`ottr ${emojis}${progress}`} />
      <div style={{display: 'flex'}}>
        <div>
          <img src="images/ottr.jpg" width={100} />
        </div>
        <div>
          <h1>ottr</h1>
          <div>running {running.length}</div>
          <div>failed {failed.length}</div>
          <div>queued {tests.length - done.length}</div>
        </div>
      </div>
      <div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start'}}>
        {tests.map(test => <TestDisplay key={test.name} test={test} />)}
      </div>
    </div>
  );
}

const mapStateToProps = ({runner: {tests}}: ReduxStateType) => ({tests});

export default connect(mapStateToProps, {})(Home);
