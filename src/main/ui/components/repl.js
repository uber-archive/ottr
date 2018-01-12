// @flow

import React from 'react';
import FontAwesome from 'react-fontawesome';
import {FontAwesomeButton} from './controls';

const DEFAULT_CODE = `
$('button').click();
t.equal($('alert').text(), 'success');
`.trim();

type Props = {};

type State = {
  code: string,
  uri: string,
  output: string,
  err?: mixed
};

const rowToString = ({type, name}) => {
  if (type === 'test') {
    return `# ${name}`;
  }
};

export default class Repl extends React.Component<Props, State> {
  iframe: HTMLIFrameElement;

  state = {
    code: DEFAULT_CODE,
    uri: '/',
    output: ''
  };

  saveIframeRef = (iframe: HTMLIFrameElement) => (this.iframe = iframe);

  updateUri = ({target: {value}}: SyntheticInputEvent<HTMLInputElement>) =>
    this.setState({uri: value});

  updateCode = (code: string) => this.setState({code});

  run = () => {
    this.iframe.contentWindow.location.replace(this.state.uri);
  };

  loaded = () => {
    const win = this.iframe.contentWindow;
    const doc = win.document;
    const script = doc.createElement('script');
    const actualCode = `
      test('new test', function(t) {
        ${this.state.code}
      });`;
    script.onload = () => {
      this.setState({output: ''});
      win.test.createStream().on('data', row => {
        this.setState(state => ({output: state.output + row}));
      });
      console.log('evaluating code ', actualCode);
      try {
        win.eval(actualCode);
      } catch (err) {
        this.setState({err});
      }
    };
    script.src = '/_ottr/tests/.ottr-webpack/repl-bundle.js';
    doc.getElementsByTagName('head')[0].appendChild(script);
  };

  render() {
    return (
      <div style={{display: 'flex', height: '100%'}}>
        <div style={{width: 400, display: 'flex', flexDirection: 'column'}}>
          <div>
            <label>
              URI: <input type="text" value={this.state.uri} onChange={this.updateUri} />
            </label>
            <FontAwesomeButton name="play" onClick={this.run} />
          </div>
          <textarea
            value={this.state.code}
            onChange={this.updateCode}
            autoFocus
            style={{
              flexGrow: 1,
              width: '100%',
              color: 'lightblue',
              background: 'black',
              fontFamily: 'monospace',
              padding: 10
            }}
          />
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '10px',
              padding: 10,
              maxHeight: 300
            }}
          >
            {this.state.output}
          </pre>
        </div>
        <iframe
          src="/"
          key={this.state.uri}
          style={{flexGrow: 1, border: 0}}
          ref={this.saveIframeRef}
          onLoad={this.loaded}
        />
      </div>
    );
  }
}
