// @flow

import React from 'react';
import {connect} from 'react-redux';
import type {ReduxStateType} from '../types';
import DocumentTitle from 'react-document-title';
import type {Session, Test} from '../../types';
import TestDisplay from './test-display';
import {Link, withRouter} from 'react-router-dom';
import {getTestsInSession, red} from '../ui-util';
import type {ContextRouter} from 'react-router-dom';
import {addQueryParams} from '../../util';
import {pollSession} from '../modules/runner';
import {FontAwesomeButton} from './controls';

const EMOJI_CHECK = '\u2705';
const EMOJI_X = '\u274C';

type Props = {pollSession: string => any, sessionId: string, session: Session, tests: Test[]};

type OwnProps = ContextRouter;

class Tests extends React.Component<Props> {
  interval: ?number;

  componentWillMount() {
    this.interval = setInterval(() => this.props.pollSession(this.props.sessionId), 1000);
  }

  componentWillUnmount() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  renderIframeToLoadTests = () => (
    <div style={{display: this.props.tests.length ? 'none' : 'block'}}>
      <div>Loading your tests...</div>
      <iframe
        key={this.props.sessionId}
        src={addQueryParams('create-session.html', {'ottr-session': this.props.sessionId})}
        width="100"
        height="100"
      />
    </div>
  );

  render() {
    const {session, tests} = this.props;
    const running = tests.filter(t => t.running);
    const failed = tests.filter(t => t.error);
    const done = tests.filter(t => t.done);
    const emojis =
      failed.length > 0
        ? failed.map(() => EMOJI_X).join('')
        : done.length > 0 && done.length === tests.length ? EMOJI_CHECK : '';
    const progress =
      done.length !== tests.length ? ` ${Math.round(done.length / tests.length * 100)}%` : '';
    return (
      <div>
        <DocumentTitle title={`ottr ${emojis}${progress}`} />
        <div style={{display: 'flex'}}>
          <div>
            <img src="images/ottr.png" width={100} />
          </div>
          <div>
            <h1 style={{marginTop: 0}}>ottr</h1>
            <div>running {running.length}</div>
            <div>failed {failed.length}</div>
            <div>queued {tests.length - done.length}</div>
            {session &&
              session.error && <div style={{background: red, color: 'white'}}>{session.error}</div>}
            <Link to="/repl" style={{color: 'black', textDecoration: 'none'}}>
              <FontAwesomeButton name="pencil-square-o" /> New Test
            </Link>
          </div>
        </div>
        {this.renderIframeToLoadTests()}
        <div style={{display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start'}}>
          {tests.map(test => <TestDisplay key={test.name} test={test} />)}
        </div>
      </div>
    );
  }
}

const mapStateToProps = ({runner: {sessions}}: ReduxStateType, {match: {params}}: OwnProps) => ({
  sessionId: params.id,
  session: (params.id && sessions[params.id]) || undefined,
  tests: params.id && sessions[params.id] ? getTestsInSession(sessions[params.id]) : []
});

export default withRouter(connect(mapStateToProps, {pollSession})(Tests));
