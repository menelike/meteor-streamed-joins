module.exports = {
  moduleNameMapper: {
    '^meteor/(.*):(.*)': '<rootDir>/mocks/meteor/$1_$2.ts',
    '^meteor/(.*)': '<rootDir>/mocks/meteor/$1.ts',
  },
  testRegex: '/src/*.*(test)\\.ts$',
  roots: ['<rootDir>/src/'],
};
