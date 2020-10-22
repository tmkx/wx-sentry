const path = require('path');
const npmDtsPlugin = require('npm-dts-webpack-plugin');

module.exports = {
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'wx-sentry.js',
    libraryTarget: 'commonjs',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            compilerOptions: {
              declaration: false,
            },
          },
        },
      },
    ],
  },
  plugins: [
    new npmDtsPlugin({
      output: 'dist/wx-sentry.d.ts',
    }),
  ],
  resolve: {
    extensions: ['.ts'],
  },
};
