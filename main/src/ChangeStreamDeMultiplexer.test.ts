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

  it('registers changeStream statically', () => {
    expect.assertions(7);

    const collection = mongoDB.db().collection(COLLECTION_NAME);
    const otherCollection = mongoDB.db().collection('otherCollection');
    const deMultiplexerStatic = new ChangeStreamDeMultiplexer();

    deMultiplexerStatic.watch(collection);

    expect(deMultiplexerStatic.hasListeners()).toBeTruthy();
    let stop = deMultiplexerStatic.addListener(
      collection,
      createListenerMock()
    );
    stop();
    expect(deMultiplexerStatic.hasListeners()).toBeTruthy();
    expect(
      deMultiplexerStatic.isWatching(collection.collectionName)
    ).toBeTruthy();

    const deMultiplexerDynamic = new ChangeStreamDeMultiplexer();

    expect(deMultiplexerDynamic.hasListeners()).toBeFalsy();
    stop = deMultiplexerDynamic.addListener(
      otherCollection,
      createListenerMock()
    );
    expect(deMultiplexerDynamic.hasListeners()).toBeTruthy();
    stop();
    expect(deMultiplexerDynamic.hasListeners()).toBeFalsy();
    expect(
      deMultiplexerDynamic.isWatching(otherCollection.collectionName)
    ).toBeFalsy();
  });

  it('do not registers changeStream statically twice', () => {
    expect.assertions(1);

    const collection = mongoDB.db().collection(COLLECTION_NAME);
    const deMultiplexer = new ChangeStreamDeMultiplexer();

    const watch1 = deMultiplexer.watch(collection);
    const watch2 = deMultiplexer.watch(collection);

    expect(watch1).toBe(watch2);
  });
});
