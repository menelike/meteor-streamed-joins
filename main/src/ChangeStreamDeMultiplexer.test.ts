import MongoMemoryReplSet from '../tests/MongoMemoryReplSet';

import ChangeStreamDeMultiplexer from './ChangeStreamDeMultiplexer';
import { ChangeStreamCallBacks } from './types';

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

const createListenerMock = (): ChangeStreamCallBacks => ({
  added: jest.fn(),
  changed: jest.fn(),
  replaced: jest.fn(),
  removed: jest.fn(),
});

describe('ChangeStreamDeMultiplexer', () => {
  it('registers a new collection', () => {
    expect.assertions(3);

    const collection = mongoDB.db().collection(COLLECTION_NAME);
    const deMultiplexer = new ChangeStreamDeMultiplexer();

    expect(deMultiplexer.hasListeners()).toBeFalsy();
    const stop = deMultiplexer.addListener(collection, createListenerMock());
    expect(deMultiplexer.hasListeners()).toBeTruthy();
    stop();
    expect(deMultiplexer.hasListeners()).toBeFalsy();
  });

  it('do not register the same listener twice', () => {
    expect.assertions(4);

    const collection = mongoDB.db().collection(COLLECTION_NAME);
    const deMultiplexer = new ChangeStreamDeMultiplexer();

    expect(deMultiplexer.hasListeners()).toBeFalsy();
    const listener = createListenerMock();
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

    expect(deMultiplexer.hasListeners()).toBeFalsy();
    const stop1 = deMultiplexer.addListener(collection, createListenerMock());
    const stop2 = deMultiplexer.addListener(collection, createListenerMock());
    expect(deMultiplexer.hasListeners()).toBeTruthy();
    stop1();
    expect(deMultiplexer.hasListeners()).toBeTruthy();
    stop2();
    expect(deMultiplexer.hasListeners()).toBeFalsy();
  });
});
