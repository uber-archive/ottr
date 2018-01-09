// @flow

import React from 'react';
import TestRunner from './test-runner';
import {connect} from 'react-redux';
import type {ReduxStateType} from '../types';

function Home({tests}) {
  return (
    <div style={{display: 'flex'}}>
      {Object.keys(tests)
        .map(name => tests[name])
        .map(test => <TestRunner test={test} key={test.name} />)}
    </div>
  );
}

const mapStateToProps = ({tests: {tests}}: ReduxStateType) => ({tests});

export default connect(mapStateToProps, {})(Home);
