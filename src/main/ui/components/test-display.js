// @flow

import React from 'react';
import TestRunner from './test-runner';
import FontAwesome from 'react-fontawesome';
import styled from 'styled-components';
import type {Test} from '../../types';
import {connect} from 'react-redux';
import {restart, stop} from '../modules/runner';

const FontAwesomeWrapper = styled.div`
  margin: 5px;
  cursor: pointer;
  display: inline-block;
  vertical-align: middle;
`;

const FontAwesomeButton = props => (
  <FontAwesomeWrapper>
    <FontAwesome {...props} />
  </FontAwesomeWrapper>
);

const red = 'red';
const green = 'lightgreen';
const blue = 'lightblue';
const gray = 'lightgray';

const colorFromTestProp = ({test}) =>
  test.error ? red : test.done ? green : test.running ? blue : gray;

const Outer = styled.div`
  max-width: 20%;
  border: 1px solid ${colorFromTestProp};
  margin: 10px;
`;

const TestName = styled.div`
  flex-grow: 1;
  font-size: 16px;
  padding: 0.5em;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  background: ${colorFromTestProp};
  color: ${({test}) => (test.error ? 'white' : 'black')};
`;

const getDisplayText = test =>
  test.skipped ? 'skipped' : !test.done && !test.running ? 'queued' : null;

type Props = {
  test: Test,
  restart: string => any,
  stop: string => any
};

type State = {
  showOutput?: boolean
};

const iconStyle = {marginRight: '1em'};

const findLastLineWithPrefix = (output, prefix) => {
  const lastLine = output.lastIndexOf(`\n${prefix}`);
  if (lastLine >= 0) {
    const lineStart = lastLine + 1;
    const nextNewline = output.indexOf('\n', lineStart);
    return nextNewline >= 0
      ? output.substring(lineStart, nextNewline)
      : output.substring(lineStart);
  }
  return null;
};

/**
 * We don't use regex here because this function will be run very frequently and I want
 * predictable running time
 */
const mostInterestingLine = output => {
  let str = findLastLineWithPrefix(output, 'not ok') || findLastLineWithPrefix(output, '# ');
  if (str) {
    return str;
  }
  // Just show the last line
  const lastNewline = output.lastIndexOf('\n');
  if (lastNewline >= 0 && lastNewline < output.length) {
    str = output.substring(lastNewline + 1);
  }
  return str || '...';
};

// eslint-disable-next-line no-shadow
class TestDisplay extends React.Component<Props, State> {
  state = {};

  toggleOutput = () => this.setState(state => ({showOutput: !state.showOutput}));

  render() {
    const {test} = this.props;
    const {error, done, running, output, skipped, name} = test;
    return (
      <Outer test={test}>
        <Header test={test}>
          <TestName>
            {error && <FontAwesome name="exclamation-triangle" style={iconStyle} />}
            {done && !error && <FontAwesome name="check-circle" style={iconStyle} />}
            {name}
          </TestName>
          <div style={{whiteSpace: 'nowrap'}}>
            <FontAwesomeButton
              name={running || done ? 'refresh' : 'play'}
              spin={running}
              onClick={() => restart(name)}
            />
            {!skipped && <FontAwesomeButton name="close" onClick={() => stop(name)} />}
          </div>
        </Header>
        <div style={{maxHeight: 200, overflow: 'scroll'}}>
          {output ? (
            <div style={{whiteSpace: this.state.showOutput ? null : 'nowrap'}}>
              <FontAwesomeButton
                name={this.state.showOutput ? 'chevron-down' : 'chevron-right'}
                style={iconStyle}
                onClick={this.toggleOutput}
              />
              {this.state.showOutput ? (
                <pre
                  style={{
                    fontSize: '10px',
                    padding: 10,
                    display: 'block'
                  }}
                >
                  {output}
                </pre>
              ) : (
                <pre
                  style={{
                    fontSize: '10px',
                    display: 'inline',
                    cursor: 'pointer'
                  }}
                  onClick={this.toggleOutput}
                >
                  {this.state.showOutput ? output : mostInterestingLine(output)}
                </pre>
              )}
            </div>
          ) : null}
          {getDisplayText(test)}
          {(running || error) && <TestRunner test={test} key={name} />}
        </div>
      </Outer>
    );
  }
}

export default connect(() => ({}), {restart, stop})(TestDisplay);
