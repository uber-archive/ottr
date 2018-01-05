// @flow

import webpack from 'webpack';
import path from 'path';

export const packageForBrowser = (jsEntryPointPath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const folder = path.resolve('.ottr-webpack');
    const filename = 'ottr-bundle.js';
    webpack(
      {
        devtool: 'inline-source-map',
        entry: path.resolve(jsEntryPointPath),
        output: {path: folder, filename},
        resolve: {alias: {fs: path.resolve(__dirname, 'noop.js')}}
      },
      (err, stats) => {
        const info = stats.toJson();

        if (stats.hasErrors()) {
          console.error(...info.errors);
        }

        if (stats.hasWarnings()) {
          console.warn(...info.warnings);
        }

        if (err || stats.hasErrors()) {
          reject(err);
          return;
        }
        resolve(path.relative(path.resolve(), `${folder}/${filename}`));
      }
    );
  });
