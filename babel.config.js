module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 12,
        },
      },
    ],
    '@babel/preset-typescript',
  ],
  plugins: [
    '@babel/plugin-transform-runtime',
    '@babel/plugin-proposal-class-properties',
  ],
  ignore: ['**/*.test.ts'],
};
