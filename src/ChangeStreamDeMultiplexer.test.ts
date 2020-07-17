import MongoMemoryReplSet from '../tests/MongoMemoryReplSet';

import ChangeStreamDeMultiplexer from './ChangeStreamDeMultiplexer';

const mongoDB = new MongoMemoryReplSet();

const COLLECTION_NAME = 'test';

beforeAll(async () => {
  await mongoDB.connect();
  await mongoDB.db().createCollection(COLLECTION_NAME);
});

afterEach(async () => {
  const db = mongoDB.db();
  await db.collection(COLLECTION_NAME).deleteMany({});
  jest.clearAllMocks();
});

afterAll(async () => {
  await mongoDB.close();
}, 20000);

describe('ChangeStreamDeMultiplexer', () => {
  it('registers a new collection', () => {
    expect.assertions(3);

    const collection = mongoDB.db().collection(COLLECTION_NAME);
    const deMultiplexer = new ChangeStreamDeMultiplexer();
    const listener = {
      added: jest.fn(),
      changed: jest.fn(),
      removed: jest.fn(),
    };

    expect(deMultiplexer.hasListeners()).toBeFalsy();
    const stop = deMultiplexer.addListener(collection, listener);
    expect(deMultiplexer.hasListeners()).toBeTruthy();
    stop();
    expect(deMultiplexer.hasListeners()).toBeFalsy();
  });

  it('do not register the same listener twice', () => {
    expect.assertions(4);

    const collection = mongoDB.db().collection(COLLECTION_NAME);
    const deMultiplexer = new ChangeStreamDeMultiplexer();
    const listener = {
      added: jest.fn(),
      changed: jest.fn(),
      removed: jest.fn(),
    };

    expect(deMultiplexer.hasListeners()).toBeFalsy();
    const stop1 = deMultiplexer.addListener(collection, listener);
    const stop2 = deMultiplexer.addListener(collection, listener);
    expect(deMultiplexer.hasListeners()).toBeTruthy();
    stop1();
    expect(deMultiplexer.hasListeners()).toBeFalsy();
    stop2();
    expect(deMultiplexer.hasListeners()).toBeFalsy();
  });

  it('do not register the same collection twice', () => {
    expect.assertions(4);

    const collection = mongoDB.db().collection(COLLECTION_NAME);
    const deMultiplexer = new ChangeStreamDeMultiplexer();
    const listener1 = {
      added: jest.fn(),
      changed: jest.fn(),
      removed: jest.fn(),
    };

    const listener2 = {
      added: jest.fn(),
      changed: jest.fn(),
      removed: jest.fn(),
    };

    expect(deMultiplexer.hasListeners()).toBeFalsy();
    const stop1 = deMultiplexer.addListener(collection, listener1);
    const stop2 = deMultiplexer.addListener(collection, listener2);
    expect(deMultiplexer.hasListeners()).toBeTruthy();
    stop1();
    expect(deMultiplexer.hasListeners()).toBeTruthy();
    stop2();
    expect(deMultiplexer.hasListeners()).toBeFalsy();
  });
});
