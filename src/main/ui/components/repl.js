// @flow

import React from 'react';
import {FontAwesomeButton} from './controls';
import {green, red} from '../ui-util';
import {Link} from "react-router-dom";

/* eslint-env browser */

const DEFAULT_CODE = `
$('button').click();
t.equal($('alert').text(), 'success');
`.trim();

function downloadWithName(uri, name) {
  const link = document.createElement('a');
  link.download = name;
  link.href = uri;
  link.click();
}

type Props = {};

type State = {
  code: string,
  uri: string,
  output: string,
  err?: mixed
};

export default class Repl extends React.Component<Props, State> {
  iframe: HTMLIFrameElement;

  state = {
    code: DEFAULT_CODE,
    uri: '/',
    output: ''
  };

  saveIframeRef = (iframe: React$ElementRef<'iframe'>) => (this.iframe = iframe);

  updateUri = ({target: {value}}: SyntheticInputEvent<HTMLInputElement>) =>
    this.setState({uri: value});

  updateCode = ({target: {value}}: SyntheticInputEvent<HTMLTextAreaElement>) =>
    this.setState({code: value});

  run = () => {
    this.iframe.contentWindow.location.replace(this.state.uri);
  };

  save = () => {
    const contents = `import {test} from 'ottr';
import $ from 'jquery';

test('${this.state.uri} works properly', '${this.state.uri}', t => {
${this.state.code.replace(/^|\n/g, '$0  ')}
});`;
    const sanitizedUri = this.state.uri.replace(/[^a-z0-9-_]/gi, '-').replace(/^-|-$/g, '');
    const filename = `ottr-${sanitizedUri || 'test'}.spec.js`.replace(/--+/g, '-');
    downloadWithName(`data:text/csv;charset=utf-8;base64,${btoa(contents)}`, filename);
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
    const failure = this.state.output.includes('\nnot ok');
    const success = !failure && this.state.output.includes('\nok');
    return (
      <div style={{display: 'flex', height: '100%'}}>
        <div style={{width: 400, display: 'flex', flexDirection: 'column'}}>
          <div style={{display: 'flex'}}>
            <Link to="/"><img src="images/ottr.jpg" width={100} /></Link>
            <div>
              <h1 style={{marginTop: 0}}>ottr</h1>
              <div><label>
                URI: <input type="text" value={this.state.uri} onChange={this.updateUri} />
              </label>
              </div>
              <FontAwesomeButton name="play" onClick={this.run} />
              <FontAwesomeButton name="floppy-o" onClick={this.save} /></div>
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
              maxHeight: 300,
              backgroundColor: failure ? red : success ? green : 'white',
              color: failure ? 'white' : 'black'
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
