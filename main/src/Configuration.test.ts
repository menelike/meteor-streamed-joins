import Configuration from './Configuration';

const TestCollectionName = 'CONFIGURATION_TEST';

describe('Configuration', () => {
  it('sets and gets idGeneration', () => {
    expect.assertions(3);

    // default
    expect(Configuration.idGeneration(TestCollectionName)).toBe('STRING');

    Configuration.setConfig({
      [TestCollectionName]: {
        idGeneration: 'STRING',
      },
    });
    expect(Configuration.idGeneration(TestCollectionName)).toBe('STRING');

    Configuration.setConfig({
      [TestCollectionName]: {
        idGeneration: 'MONGO',
      },
    });
    expect(Configuration.idGeneration(TestCollectionName)).toBe('MONGO');
  });
});
