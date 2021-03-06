module.exports = {
  testRegex: '/src/*.*(test)\\.ts$',
  roots: ['<rootDir>/src/'],
  collectCoverageFrom: ['src/**/*.ts'],
  setupFiles: ['./mocks/global.ts'],
};
