const path = require('path');
const { ProgressPlugin } = require('webpack');
const NpmDtsPlugin = require('npm-dts-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
  entry: './src/index.ts',
  mode: 'production',
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
    new ProgressPlugin({}),
    new CleanWebpackPlugin({}),
    new NpmDtsPlugin({
      logLevel: 'warn',
      output: 'dist/wx-sentry.d.ts',
    }),
  ],
  resolve: {
    extensions: ['.ts'],
  },
};
