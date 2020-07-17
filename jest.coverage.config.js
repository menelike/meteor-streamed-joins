module.exports = {
  testRegex: '/src/*.*(test)\\.ts$',
  roots: ['<rootDir>/src/', '<rootDir>/__mocks__/'],
  collectCoverageFrom: [
    'src/**/*.ts',
  ],
};
