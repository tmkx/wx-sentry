const { DefinePlugin } = require('webpack');
const { merge } = require('webpack-merge');
const commonConfig = require('./webpack.common');

module.exports = merge(commonConfig, {
  plugins: [
    new DefinePlugin({
      __LOG__: false,
    }),
  ],
});
